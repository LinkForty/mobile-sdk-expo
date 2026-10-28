import * as Linking from 'expo-linking';
import type { FingerprintCollectorProtocol } from '../fingerprint/fingerprint-collector';
import type { NetworkManagerProtocol } from '../network/network-manager';
import type { DeepLinkData } from '../models/deep-link-data';
import { parseDeepLinkUrl, parseUrlString, buildQueryString, mergeUrlParameters, hostOf } from './url-parser';
import type { LinkDomains } from './link-domains';
import { logger } from '../logger';

export type DeferredDeepLinkCallback = (deepLinkData: DeepLinkData | null) => void;
export type DeepLinkCallback = (url: string, deepLinkData: DeepLinkData | null) => void;

export class DeepLinkHandler {
  private baseUrl: string;
  private network: NetworkManagerProtocol;
  private fingerprint: FingerprintCollectorProtocol;
  private linkDomains: LinkDomains | null;

  private deferredCallbacks: DeferredDeepLinkCallback[] = [];
  private deepLinkCallbacks: DeepLinkCallback[] = [];
  private openListeners: DeepLinkCallback[] = [];
  /**
   * A direct deep link handled while no `onDeepLink` callback was registered,
   * typically the link that launched the app. Delivered to the first callback.
   */
  private pendingDeepLink: { url: string; data: DeepLinkData | null } | null = null;
  private deferredDelivered = false;
  private cachedDeferredData: DeepLinkData | null = null;
  private subscription: { remove(): void } | null = null;

  constructor(
    baseUrl: string,
    network: NetworkManagerProtocol,
    fingerprint: FingerprintCollectorProtocol,
    linkDomains?: LinkDomains,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.network = network;
    this.fingerprint = fingerprint;
    this.linkDomains = linkDomains ?? null;
  }

  /**
   * Start listening for deep links via expo-linking.
   */
  startListening(): void {
    this.subscription = Linking.addEventListener('url', (event: { url: string }) => {
      this.handleUrl(event.url);
    });

    // Check if app was opened via deep link
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          this.handleUrl(url);
        }
      })
      .catch((e) => {
        logger.warn('Failed to get initial URL:', e);
      });
  }

  /**
   * Manually pass a deep link URL.
   */
  handleDeepLink(url: string): void {
    this.handleUrl(url);
  }

  /**
   * Register a deferred deep link callback.
   * If data was already delivered, calls back immediately.
   */
  onDeferredDeepLink(callback: DeferredDeepLinkCallback): void {
    this.deferredCallbacks.push(callback);

    if (this.deferredDelivered) {
      callback(this.cachedDeferredData);
    }
  }

  /**
   * Register a direct deep link callback. Multiple callbacks supported.
   *
   * A link handled before any callback was registered (typically the link that
   * launched the app) is delivered once, in a microtask, to the first callback.
   */
  onDeepLink(callback: DeepLinkCallback): void {
    const pending = this.pendingDeepLink;
    const isFirstCallback = this.deepLinkCallbacks.length === 0;
    this.deepLinkCallbacks.push(callback);

    if (pending && isFirstCallback) {
      queueMicrotask(() => {
        if (this.pendingDeepLink !== pending) return;
        this.pendingDeepLink = null;
        for (const cb of [...this.deepLinkCallbacks]) cb(pending.url, pending.data);
      });
    }
  }

  /**
   * Register an SDK-internal listener for every direct deep link open. Unlike
   * `onDeepLink` callbacks, these don't count as a registration: a link they
   * see is still held for the first `onDeepLink` callback.
   */
  onDeepLinkOpened(listener: DeepLinkCallback): void {
    this.openListeners.push(listener);
  }

  /**
   * Deliver deferred deep link data (called by SDK after install attribution).
   */
  deliverDeferredDeepLink(data: DeepLinkData | null): void {
    this.cachedDeferredData = data;
    this.deferredDelivered = true;
    logger.log('Delivering deferred deep link:', data?.shortCode ?? 'organic');

    for (const cb of this.deferredCallbacks) {
      cb(data);
    }
  }

  clearCallbacks(): void {
    this.deferredCallbacks = [];
    this.deepLinkCallbacks = [];
    this.openListeners = [];
    this.pendingDeepLink = null;
    this.deferredDelivered = false;
    this.cachedDeferredData = null;
  }

  cleanup(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.clearCallbacks();
  }

  private handleUrl(url: string): void {
    if (!url) return;

    logger.log('Handling deep link:', url);

    void this.isLinkFortyUrl(url).then((lookUp) => {
      // A LinkForty URL is parsed locally as the fallback, then resolved on
      // the server; any other URL reaches the callbacks as null.
      const localData = lookUp ? parseDeepLinkUrl(url) : null;
      if (!localData) {
        this.deliver(url, null);
        return;
      }

      this.resolveUrl(url)
        .then((resolvedData) => {
          // The resolve returns the link's stored configuration; the
          // parameters on the URL that was tapped are known only here.
          const data = resolvedData
            ? mergeUrlParameters(resolvedData, localData.customParameters)
            : localData;
          this.deliver(url, data);
        })
        .catch(() => {
          this.deliver(url, localData);
        });
    });
  }

  /**
   * Hands a handled link to the internal listeners, then to the `onDeepLink`
   * callbacks, or holds it for the first one when none is registered yet.
   */
  private deliver(url: string, data: DeepLinkData | null): void {
    for (const listener of [...this.openListeners]) listener(url, data);

    if (this.deepLinkCallbacks.length === 0) {
      logger.log('No onDeepLink callback registered yet; holding the link for the first one');
      this.pendingDeepLink = { url, data };
      return;
    }
    for (const cb of [...this.deepLinkCallbacks]) cb(url, data);
  }

  /**
   * Whether `url` is on the base URL's host or one of the workspace's link
   * hosts (see LinkDomains).
   */
  private async isLinkFortyUrl(url: string): Promise<boolean> {
    if (this.linkDomains) return this.linkDomains.shouldLookUp(url);
    const host = hostOf(url);
    return host !== null && host === hostOf(this.baseUrl);
  }

  private async resolveUrl(url: string): Promise<DeepLinkData | null> {
    const parsed = parseUrlString(url);
    if (!parsed) return null;

    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    if (pathSegments.length === 0) return null;

    let resolvePath: string;
    if (pathSegments.length >= 2) {
      resolvePath = `/api/sdk/v1/resolve/${pathSegments[0]}/${pathSegments[1]}`;
    } else {
      resolvePath = `/api/sdk/v1/resolve/${pathSegments[0]}`;
    }

    // Collect fingerprint for click attribution
    try {
      const fp = this.fingerprint.collect(168);
      const fpParams: Record<string, string> = {
        fp_tz: fp.timezone,
        fp_lang: fp.language,
        fp_sw: String(fp.screenWidth),
        fp_sh: String(fp.screenHeight),
        fp_platform: fp.platform,
        fp_pv: fp.platformVersion,
      };
      resolvePath += `?${buildQueryString(fpParams)}`;
    } catch (e) {
      logger.warn('Fingerprint collection failed, resolving without fingerprint:', e);
    }

    try {
      return await this.network.request<DeepLinkData>(resolvePath);
    } catch (e) {
      logger.warn('Server-side resolution failed:', e);
      return null;
    }
  }
}

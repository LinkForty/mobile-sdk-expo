import * as Linking from 'expo-linking';
import type { FingerprintCollectorProtocol } from '../fingerprint/fingerprint-collector';
import type { NetworkManagerProtocol } from '../network/network-manager';
import type { DeepLinkData } from '../models/deep-link-data';
import { parseDeepLinkUrl, parseUrlString, buildQueryString } from './url-parser';
import { logger } from '../logger';

export type DeferredDeepLinkCallback = (deepLinkData: DeepLinkData | null) => void;
export type DeepLinkCallback = (url: string, deepLinkData: DeepLinkData | null) => void;

export class DeepLinkHandler {
  private baseUrl: string;
  private network: NetworkManagerProtocol;
  private fingerprint: FingerprintCollectorProtocol;

  private deferredCallbacks: DeferredDeepLinkCallback[] = [];
  private deepLinkCallbacks: DeepLinkCallback[] = [];
  private deferredDelivered = false;
  private cachedDeferredData: DeepLinkData | null = null;
  private subscription: { remove(): void } | null = null;

  constructor(
    baseUrl: string,
    network: NetworkManagerProtocol,
    fingerprint: FingerprintCollectorProtocol,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.network = network;
    this.fingerprint = fingerprint;
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
   */
  onDeepLink(callback: DeepLinkCallback): void {
    this.deepLinkCallbacks.push(callback);
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
    this.deferredDelivered = false;
    this.cachedDeferredData = null;
  }

  cleanup(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.clearCallbacks();
  }

  private handleUrl(url: string): void {
    if (!url || this.deepLinkCallbacks.length === 0) return;

    logger.log('Handling deep link:', url);

    // Parse locally first as fallback
    const localData = parseDeepLinkUrl(url, this.baseUrl);

    // If this is a LinkForty URL, try server-side resolution
    if (localData && url.startsWith(this.baseUrl)) {
      this.resolveUrl(url)
        .then((resolvedData) => {
          const data = resolvedData ?? localData;
          for (const cb of this.deepLinkCallbacks) cb(url, data);
        })
        .catch(() => {
          for (const cb of this.deepLinkCallbacks) cb(url, localData);
        });
    } else {
      for (const cb of this.deepLinkCallbacks) cb(url, localData);
    }
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

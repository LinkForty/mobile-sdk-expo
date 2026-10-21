import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NetworkManagerProtocol } from '../network/network-manager';
import { LinkFortyError } from '../errors/linkforty-error';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { hostOf } from './url-parser';
import { logger } from '../logger';

/** How long a link waits for the first fetch when no list was saved earlier. */
const FIRST_FETCH_WAIT_MS = 3000;

/**
 * The hosts the app's workspace serves links on, which decide whether a URL is
 * looked up as a LinkForty link.
 *
 * Learned from `GET /api/sdk/v1/link-domains` with the app token, and saved, so
 * a later launch knows them before the refresh finishes. Unknown without an
 * app token, or on a server without the endpoint; then only URLs on the base
 * URL's host are looked up.
 */
export class LinkDomains {
  private readonly baseHost: string | null;
  private hosts: Set<string> | null = null;
  private ready: Promise<void> = Promise.resolve();

  constructor(
    baseUrl: string,
    private readonly network: NetworkManagerProtocol,
    private readonly appToken?: string,
  ) {
    this.baseHost = hostOf(baseUrl);
  }

  /**
   * Loads the saved hosts and, with an app token, refreshes them in the
   * background. Links handled before the first fetch wait for it, at most
   * 3 seconds, when no list was saved on an earlier launch.
   */
  start(): void {
    this.ready = (async () => {
      await this.load();
      if (!this.appToken) return;
      const refresh = this.refresh();
      if (this.hosts === null) {
        await Promise.race([refresh, new Promise((r) => setTimeout(r, FIRST_FETCH_WAIT_MS))]);
      }
    })();
  }

  /**
   * Whether `url` is looked up as a LinkForty link: an `http(s)` URL on the
   * base URL's host or a workspace link host. Other schemes never are.
   */
  async shouldLookUp(url: string): Promise<boolean> {
    await this.ready;
    const host = hostOf(url);
    if (!host) return false;
    if (host === this.baseHost) return true;
    return this.hosts?.has(host) ?? false;
  }

  /**
   * Fetches the hosts. A 2xx replaces the saved list; a 4xx (no such app
   * token, or a server without the endpoint) forgets it; a network or server
   * error keeps what is known.
   */
  async refresh(): Promise<void> {
    try {
      const response = await this.network.request<{ domains: string[] }>(
        '/api/sdk/v1/link-domains',
      );
      await this.update(new Set(response.domains.map((d) => d.toLowerCase())));
    } catch (e) {
      const status = e instanceof LinkFortyError ? e.statusCode : undefined;
      if (status !== undefined && status >= 400 && status < 500) {
        logger.log(`Link domains unavailable (${status}); looking up links on the base URL only`);
        await this.update(null);
      } else {
        logger.log('Link domains refresh failed, keeping what is known:', e);
      }
    }
  }

  private async load(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.LINK_DOMAINS);
      if (saved && this.hosts === null) {
        this.hosts = new Set(JSON.parse(saved) as string[]);
      }
    } catch (e) {
      logger.warn('Failed to read saved link domains:', e);
    }
  }

  private async update(hosts: Set<string> | null): Promise<void> {
    this.hosts = hosts;
    try {
      if (hosts) {
        await AsyncStorage.setItem(STORAGE_KEYS.LINK_DOMAINS, JSON.stringify([...hosts].sort()));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.LINK_DOMAINS);
      }
    } catch (e) {
      logger.warn('Failed to save link domains:', e);
    }
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinkDomains } from '../../src/deeplink/link-domains';
import { DeepLinkHandler } from '../../src/deeplink/deep-link-handler';
import { LinkFortyError } from '../../src/errors/linkforty-error';
import { STORAGE_KEYS } from '../../src/storage/storage-keys';
import type { NetworkManagerProtocol } from '../../src/network/network-manager';
import type { FingerprintCollectorProtocol } from '../../src/fingerprint/fingerprint-collector';

const BASE = 'https://api.example.com';
const TOKEN = 'at_0123456789abcdef0123456789abcdef';

function domainsNetwork(domains: string[]): NetworkManagerProtocol {
  return {
    request: vi.fn(async (endpoint: string) => {
      if (endpoint === '/api/sdk/v1/link-domains') return { domains } as never;
      return { shortCode: 'resolved', customParameters: { from: 'server' } } as never;
    }),
  };
}

const fingerprint: FingerprintCollectorProtocol = {
  collect: vi.fn(() => ({
    userAgent: 'TestApp/1.0.0 ios/17.4',
    timezone: 'America/New_York',
    language: 'en-US',
    screenWidth: 393,
    screenHeight: 852,
    platform: 'ios',
    platformVersion: '17.4',
    appVersion: '1.0.0',
    attributionWindowHours: 168,
  })),
};

describe('LinkDomains', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('looks up links on the workspace link hosts', async () => {
    const domains = new LinkDomains(BASE, domainsNetwork(['acme.toapp.me', 'links.acme.com']), TOKEN);
    domains.start();

    expect(await domains.shouldLookUp('https://acme.toapp.me/abc')).toBe(true);
    expect(await domains.shouldLookUp('https://LINKS.acme.com/tmpl/abc?x=1')).toBe(true);
    expect(await domains.shouldLookUp('https://api.example.com/abc')).toBe(true);
    expect(await domains.shouldLookUp('https://other.com/abc')).toBe(false);
    expect(await domains.shouldLookUp('myapp://product/1')).toBe(false);
  });

  it('saves the hosts for the next launch', async () => {
    const domains = new LinkDomains(BASE, domainsNetwork(['acme.toapp.me']), TOKEN);
    domains.start();
    await domains.shouldLookUp('https://acme.toapp.me/abc');

    expect(await AsyncStorage.getItem(STORAGE_KEYS.LINK_DOMAINS)).toBe('["acme.toapp.me"]');
  });

  it('uses the saved hosts while the refresh fails', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.LINK_DOMAINS, '["acme.toapp.me"]');
    const network = { request: vi.fn().mockRejectedValue(LinkFortyError.invalidResponse(503)) };
    const domains = new LinkDomains(BASE, network, TOKEN);
    domains.start();

    expect(await domains.shouldLookUp('https://acme.toapp.me/abc')).toBe(true);
    expect(await AsyncStorage.getItem(STORAGE_KEYS.LINK_DOMAINS)).toBe('["acme.toapp.me"]');
  });

  it('forgets the hosts on a 4xx and looks up the base URL host only', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.LINK_DOMAINS, '["acme.toapp.me"]');
    const network = { request: vi.fn().mockRejectedValue(LinkFortyError.invalidResponse(404)) };
    const domains = new LinkDomains(BASE, network, TOKEN);
    domains.start();
    await domains.refresh();

    expect(await domains.shouldLookUp('https://acme.toapp.me/abc')).toBe(false);
    expect(await domains.shouldLookUp('https://api.example.com/abc')).toBe(true);
    expect(await AsyncStorage.getItem(STORAGE_KEYS.LINK_DOMAINS)).toBeNull();
  });

  it('does not fetch without an app token', async () => {
    const network = domainsNetwork(['acme.toapp.me']);
    const domains = new LinkDomains(BASE, network);
    domains.start();

    expect(await domains.shouldLookUp('https://acme.toapp.me/abc')).toBe(false);
    expect(await domains.shouldLookUp('https://api.example.com/abc')).toBe(true);
    expect(network.request).not.toHaveBeenCalled();
  });

  it('waits at most 3 seconds for the first fetch', async () => {
    vi.useFakeTimers();
    const network = { request: vi.fn(() => new Promise<never>(() => {})) };
    const domains = new LinkDomains(BASE, network, TOKEN);
    domains.start();

    let answer: boolean | undefined;
    void domains.shouldLookUp('https://acme.toapp.me/abc').then((a) => { answer = a; });
    await vi.advanceTimersByTimeAsync(2900);
    expect(answer).toBeUndefined();
    await vi.advanceTimersByTimeAsync(200);
    expect(answer).toBe(false);
  });
});

describe('DeepLinkHandler with link domains', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('resolves a link on a workspace link host that is not the base URL', async () => {
    const network = domainsNetwork(['acme.toapp.me']);
    const domains = new LinkDomains(BASE, network, TOKEN);
    domains.start();
    const handler = new DeepLinkHandler(BASE, network, fingerprint, domains);

    const callback = vi.fn();
    handler.onDeepLink(callback);
    handler.handleDeepLink('https://acme.toapp.me/abc?ref=mail');
    await new Promise((r) => setTimeout(r, 50));

    const endpoints = (network.request as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(endpoints.some((e: string) => e.startsWith('/api/sdk/v1/resolve/abc?'))).toBe(true);
    expect(callback).toHaveBeenCalledWith('https://acme.toapp.me/abc?ref=mail', {
      shortCode: 'resolved',
      customParameters: { from: 'server', ref: 'mail' },
    });
  });

  it('hands other URLs to the callback as null without a lookup', async () => {
    const network = domainsNetwork(['acme.toapp.me']);
    const domains = new LinkDomains(BASE, network, TOKEN);
    domains.start();
    const handler = new DeepLinkHandler(BASE, network, fingerprint, domains);

    const callback = vi.fn();
    handler.onDeepLink(callback);
    handler.handleDeepLink('https://shop.example.org/product/5');
    await new Promise((r) => setTimeout(r, 50));

    const endpoints = (network.request as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(endpoints).toEqual(['/api/sdk/v1/link-domains']);
    expect(callback).toHaveBeenCalledWith('https://shop.example.org/product/5', null);
  });
});

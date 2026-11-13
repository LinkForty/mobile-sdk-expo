import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeepLinkHandler } from '../../src/deeplink/deep-link-handler';
import type { NetworkManagerProtocol } from '../../src/network/network-manager';
import type { FingerprintCollectorProtocol } from '../../src/fingerprint/fingerprint-collector';
import type { DeepLinkData } from '../../src/models/deep-link-data';

function createMockNetwork(resolveData?: DeepLinkData): NetworkManagerProtocol {
  return {
    request: vi.fn(async () => resolveData ?? null),
  };
}

function createMockFingerprint(): FingerprintCollectorProtocol {
  return {
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
}

describe('DeepLinkHandler', () => {
  let network: NetworkManagerProtocol;
  let fingerprint: FingerprintCollectorProtocol;

  beforeEach(() => {
    fingerprint = createMockFingerprint();
  });

  describe('deferred deep links', () => {
    it('delivers deferred data to registered callbacks', () => {
      network = createMockNetwork();
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      const callback = vi.fn();
      handler.onDeferredDeepLink(callback);

      const data: DeepLinkData = { shortCode: 'abc123', iosUrl: 'myapp://test' };
      handler.deliverDeferredDeepLink(data);

      expect(callback).toHaveBeenCalledWith(data);
    });

    it('delivers null for organic installs', () => {
      network = createMockNetwork();
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      const callback = vi.fn();
      handler.onDeferredDeepLink(callback);
      handler.deliverDeferredDeepLink(null);

      expect(callback).toHaveBeenCalledWith(null);
    });

    it('delivers cached data to late-registered callbacks', () => {
      network = createMockNetwork();
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      const data: DeepLinkData = { shortCode: 'late' };
      handler.deliverDeferredDeepLink(data);

      const callback = vi.fn();
      handler.onDeferredDeepLink(callback);

      expect(callback).toHaveBeenCalledWith(data);
    });

    it('supports multiple callbacks', () => {
      network = createMockNetwork();
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      const cb1 = vi.fn();
      const cb2 = vi.fn();
      handler.onDeferredDeepLink(cb1);
      handler.onDeferredDeepLink(cb2);

      handler.deliverDeferredDeepLink({ shortCode: 'multi' });

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });
  });

  describe('direct deep links', () => {
    it('resolves LinkForty URL via server and delivers to callback', async () => {
      const resolvedData: DeepLinkData = {
        shortCode: 'abc123',
        customParameters: { route: 'product' },
      };
      network = createMockNetwork(resolvedData);
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      const callback = vi.fn();
      handler.onDeepLink(callback);
      handler.handleDeepLink('https://go.example.com/abc123');

      // Wait for async resolution
      await new Promise((r) => setTimeout(r, 50));

      expect(callback).toHaveBeenCalledWith('https://go.example.com/abc123', resolvedData);
      expect(network.request).toHaveBeenCalled();
    });

    it('falls back to local parse when server fails', async () => {
      network = { request: vi.fn().mockRejectedValue(new Error('Network error')) };
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      const callback = vi.fn();
      handler.onDeepLink(callback);
      handler.handleDeepLink('https://go.example.com/abc123');

      await new Promise((r) => setTimeout(r, 50));

      expect(callback).toHaveBeenCalledWith(
        'https://go.example.com/abc123',
        expect.objectContaining({ shortCode: 'abc123' }),
      );
    });

    it('supports multiple direct deep link callbacks', async () => {
      network = { request: vi.fn().mockRejectedValue(new Error('fail')) };
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      const cb1 = vi.fn();
      const cb2 = vi.fn();
      handler.onDeepLink(cb1);
      handler.onDeepLink(cb2);

      handler.handleDeepLink('https://go.example.com/xyz');

      await new Promise((r) => setTimeout(r, 50));

      expect(cb1).toHaveBeenCalled();
      expect(cb2).toHaveBeenCalled();
    });

    it('passes fingerprint query params to resolve endpoint', async () => {
      network = createMockNetwork({ shortCode: 'abc' });
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      const callback = vi.fn();
      handler.onDeepLink(callback);
      handler.handleDeepLink('https://go.example.com/abc');

      await new Promise((r) => setTimeout(r, 50));

      const requestCall = (network.request as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(requestCall[0]).toContain('/api/sdk/v1/resolve/abc');
      expect(requestCall[0]).toContain('fp_tz=');
      expect(requestCall[0]).toContain('fp_lang=');
    });

    it('handles template slug URLs', async () => {
      network = createMockNetwork({ shortCode: 'abc' });
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      const callback = vi.fn();
      handler.onDeepLink(callback);
      handler.handleDeepLink('https://go.example.com/tmpl/abc');

      await new Promise((r) => setTimeout(r, 50));

      const requestCall = (network.request as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(requestCall[0]).toContain('/api/sdk/v1/resolve/tmpl/abc');
    });

    it('delivers local data for non-LinkForty URLs without server resolution', async () => {
      network = createMockNetwork({ shortCode: 'should-not-call' });
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      const callback = vi.fn();
      handler.onDeepLink(callback);
      handler.handleDeepLink('https://other-domain.com/something');

      await new Promise((r) => setTimeout(r, 50));

      // Should not attempt server resolution (different domain)
      expect(network.request).not.toHaveBeenCalled();
      // Callback gets null since baseUrl doesn't match
      expect(callback).toHaveBeenCalledWith('https://other-domain.com/something', null);
    });

    it('holds a link handled before any callback and delivers it to the first one', async () => {
      network = createMockNetwork({ shortCode: 'abc', linkId: 'link-1' });
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      // No callbacks registered yet — should not throw
      handler.handleDeepLink('https://go.example.com/abc');
      await new Promise((r) => setTimeout(r, 50));

      const first = vi.fn();
      handler.onDeepLink(first);
      // Delivered in a microtask, not during registration
      expect(first).not.toHaveBeenCalled();
      await Promise.resolve();
      expect(first).toHaveBeenCalledTimes(1);
      expect(first).toHaveBeenCalledWith(
        'https://go.example.com/abc',
        expect.objectContaining({ shortCode: 'abc', linkId: 'link-1' }),
      );

      // Only once: a later registration and a later link don't replay it
      const second = vi.fn();
      handler.onDeepLink(second);
      await Promise.resolve();
      expect(second).not.toHaveBeenCalled();
    });

    it('delivers a held link to every callback registered in the same tick', async () => {
      network = createMockNetwork();
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);
      handler.handleDeepLink('https://elsewhere.example.org/x');
      await new Promise((r) => setTimeout(r, 50));

      const a = vi.fn();
      const b = vi.fn();
      handler.onDeepLink(a);
      handler.onDeepLink(b);
      await Promise.resolve();

      expect(a).toHaveBeenCalledWith('https://elsewhere.example.org/x', null);
      expect(b).toHaveBeenCalledWith('https://elsewhere.example.org/x', null);
    });

    it('keeps only the latest link handled before any callback', async () => {
      network = createMockNetwork();
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);
      handler.handleDeepLink('https://elsewhere.example.org/1');
      handler.handleDeepLink('https://elsewhere.example.org/2');
      await new Promise((r) => setTimeout(r, 50));

      const cb = vi.fn();
      handler.onDeepLink(cb);
      await Promise.resolve();

      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith('https://elsewhere.example.org/2', null);
    });

    it('tells internal open listeners about a link without counting as a callback', async () => {
      network = createMockNetwork({ shortCode: 'abc', linkId: 'link-1' });
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);
      const listener = vi.fn();
      handler.onDeepLinkOpened(listener);

      handler.handleDeepLink('https://go.example.com/abc');
      await new Promise((r) => setTimeout(r, 50));
      expect(listener).toHaveBeenCalledWith(
        'https://go.example.com/abc',
        expect.objectContaining({ linkId: 'link-1' }),
      );

      const cb = vi.fn();
      handler.onDeepLink(cb);
      await Promise.resolve();
      expect(cb).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('resolves without fingerprint when collector throws', async () => {
      const failingFingerprint: FingerprintCollectorProtocol = {
        collect: vi.fn(() => { throw new Error('Sensor unavailable'); }),
      };
      network = createMockNetwork({ shortCode: 'abc' });
      const handler = new DeepLinkHandler('https://go.example.com', network, failingFingerprint);

      const callback = vi.fn();
      handler.onDeepLink(callback);
      handler.handleDeepLink('https://go.example.com/abc');

      await new Promise((r) => setTimeout(r, 50));

      // Should still attempt resolve (without fingerprint params)
      expect(network.request).toHaveBeenCalled();
      const endpoint = (network.request as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(endpoint).toContain('/api/sdk/v1/resolve/abc');
      expect(endpoint).not.toContain('fp_tz=');
    });
  });

  describe('resolve request', () => {
    async function resolveEndpointFor(url: string, fp: FingerprintCollectorProtocol = fingerprint): Promise<string> {
      network = createMockNetwork({ shortCode: 'abc' });
      const handler = new DeepLinkHandler('https://go.example.com', network, fp);
      handler.onDeepLink(vi.fn());
      handler.handleDeepLink(url);
      await vi.waitFor(() => expect(network.request).toHaveBeenCalledTimes(1));
      return (network.request as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    }

    function queryOf(endpoint: string): Record<string, string> {
      const query = endpoint.includes('?') ? endpoint.slice(endpoint.indexOf('?') + 1) : '';
      return Object.fromEntries(new URLSearchParams(query));
    }

    it("passes the link's query parameters along with the fingerprint", async () => {
      const endpoint = await resolveEndpointFor('https://go.example.com/abc?os_id=u1&utm_campaign=winback');

      expect(endpoint.startsWith('/api/sdk/v1/resolve/abc?')).toBe(true);
      expect(queryOf(endpoint)).toEqual({
        os_id: 'u1',
        utm_campaign: 'winback',
        fp_tz: 'America/New_York',
        fp_lang: 'en-US',
        fp_sw: '393',
        fp_sh: '852',
        fp_platform: 'ios',
        fp_pv: '17.4',
      });
    });

    it('keeps its own fingerprint values over fp_ parameters on the link', async () => {
      const query = queryOf(await resolveEndpointFor('https://go.example.com/abc?fp_tz=evil&FP_LANG=evil&os_id=u1'));

      expect(query.fp_tz).toBe('America/New_York');
      expect(query.fp_lang).toBe('en-US');
      expect(query.FP_LANG).toBeUndefined();
      expect(query.os_id).toBe('u1');
    });

    it('encodes values once', async () => {
      const query = queryOf(await resolveEndpointFor(`https://go.example.com/abc?note=${encodeURIComponent('a b&c')}`));

      expect(query.note).toBe('a b&c');
    });

    it('reads a literal "+" in the link as a space, as a server does, and keeps %2B as "+"', async () => {
      const query = queryOf(await resolveEndpointFor('https://go.example.com/abc?iterable_id=a+b%40x.com&email=c%2Bd%40x.com'));

      expect(query.iterable_id).toBe('a b@x.com');
      expect(query.email).toBe('c+d@x.com');
    });

    it("passes the link's parameters when the fingerprint can't be collected", async () => {
      const failing: FingerprintCollectorProtocol = {
        collect: vi.fn(() => {
          throw new Error('no device info');
        }),
      };
      const endpoint = await resolveEndpointFor('https://go.example.com/tmpl/abc?os_id=u1', failing);

      expect(endpoint).toBe('/api/sdk/v1/resolve/tmpl/abc?os_id=u1');
    });

    it('sends only the fingerprint for a link with no query', async () => {
      const query = queryOf(await resolveEndpointFor('https://go.example.com/abc'));

      expect(Object.keys(query).sort()).toEqual(['fp_lang', 'fp_platform', 'fp_pv', 'fp_sh', 'fp_sw', 'fp_tz']);
    });
  });

  describe('clearCallbacks', () => {
    it('clears all callbacks and state', () => {
      network = createMockNetwork();
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      handler.onDeferredDeepLink(vi.fn());
      handler.onDeepLink(vi.fn());
      handler.deliverDeferredDeepLink({ shortCode: 'x' });

      handler.clearCallbacks();

      // Late-registered callback should NOT get called (deferred state cleared)
      const lateCb = vi.fn();
      handler.onDeferredDeepLink(lateCb);
      expect(lateCb).not.toHaveBeenCalled();
    });

    it('drops a link held for the first callback', async () => {
      network = createMockNetwork();
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);
      handler.handleDeepLink('https://elsewhere.example.org/x');
      await new Promise((r) => setTimeout(r, 50));

      handler.clearCallbacks();
      const cb = vi.fn();
      handler.onDeepLink(cb);
      await Promise.resolve();
      expect(cb).not.toHaveBeenCalled();
    });
  });
});

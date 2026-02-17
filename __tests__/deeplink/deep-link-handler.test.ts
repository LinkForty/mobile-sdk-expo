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

    it('does not call callbacks when none registered', async () => {
      network = createMockNetwork();
      const handler = new DeepLinkHandler('https://go.example.com', network, fingerprint);

      // No callbacks registered — should not throw
      handler.handleDeepLink('https://go.example.com/abc');

      await new Promise((r) => setTimeout(r, 50));

      expect(network.request).not.toHaveBeenCalled();
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
  });
});

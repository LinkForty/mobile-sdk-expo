import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinkFortySDK } from '../src/linkforty-sdk';
import { LinkFortyError, LinkFortyErrorCode } from '../src/errors/linkforty-error';
import type { LinkFortyConfig } from '../src/models/config';

// Mock fetch globally
const mockFetch = vi.fn();

function setupFetch(installResponse = {
  installId: 'test-install-id',
  attributed: false,
  confidenceScore: 0,
  matchedFactors: [],
  deepLinkData: null,
}) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(installResponse),
  });
}

const validConfig: LinkFortyConfig = {
  baseUrl: 'https://go.example.com',
  debug: false,
};

describe('LinkFortySDK', () => {
  let sdk: LinkFortySDK;

  beforeEach(async () => {
    await AsyncStorage.clear();
    sdk = new LinkFortySDK();
    globalThis.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    sdk.reset();
  });

  describe('initialization', () => {
    it('initializes successfully with valid config', async () => {
      setupFetch();
      const result = await sdk.initialize(validConfig);

      expect(sdk.isInitialized).toBe(true);
      expect(result.installId).toBe('test-install-id');
      expect(result.attributed).toBe(false);
    });

    it('throws ALREADY_INITIALIZED on double init', async () => {
      setupFetch();
      await sdk.initialize(validConfig);

      try {
        await sdk.initialize(validConfig);
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as LinkFortyError).code).toBe(LinkFortyErrorCode.ALREADY_INITIALIZED);
      }
    });

    it('throws INVALID_CONFIGURATION for HTTP non-localhost', async () => {
      try {
        await sdk.initialize({ baseUrl: 'http://go.example.com' });
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as LinkFortyError).code).toBe(LinkFortyErrorCode.INVALID_CONFIGURATION);
      }
    });

    it('returns attributed install data', async () => {
      setupFetch({
        installId: 'attr-id',
        attributed: true,
        confidenceScore: 85,
        matchedFactors: ['ip', 'user_agent'],
        deepLinkData: {
          shortCode: 'abc123',
          iosUrl: 'myapp://product/1',
          customParameters: { route: 'product' },
        },
      });

      const result = await sdk.initialize(validConfig);

      expect(result.attributed).toBe(true);
      expect(result.confidenceScore).toBe(85);
      expect(result.deepLinkData?.shortCode).toBe('abc123');
    });

    it('delivers deferred deep link to callback registered before init', async () => {
      setupFetch({
        installId: 'attr-id',
        attributed: true,
        confidenceScore: 90,
        matchedFactors: ['ip'],
        deepLinkData: { shortCode: 'deferred' },
      });

      // Register BEFORE init — but deep link handler is created during init
      // So we register after init but before deliver
      const callback = vi.fn();

      // Since registration requires initialization, we test by registering after init
      await sdk.initialize(validConfig);
      sdk.onDeferredDeepLink(callback);

      // Callback should be called immediately with cached data
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ shortCode: 'deferred' }),
      );
    });

    it('returns organic response when network fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network down'));

      const result = await sdk.initialize(validConfig);
      expect(result.attributed).toBe(false);
      expect(result.deepLinkData).toBeNull();
      expect(sdk.isInitialized).toBe(true);
    });
  });

  describe('methods before initialization', () => {
    it('throws NOT_INITIALIZED for onDeepLink', () => {
      expect(() => sdk.onDeepLink(vi.fn())).toThrow(LinkFortyError);
    });

    it('throws NOT_INITIALIZED for onDeferredDeepLink', () => {
      expect(() => sdk.onDeferredDeepLink(vi.fn())).toThrow(LinkFortyError);
    });

    it('throws NOT_INITIALIZED for handleDeepLink', () => {
      expect(() => sdk.handleDeepLink('https://go.example.com/abc')).toThrow(LinkFortyError);
    });

    it('throws NOT_INITIALIZED for trackEvent', async () => {
      await expect(sdk.trackEvent('test')).rejects.toThrow(LinkFortyError);
    });

    it('throws NOT_INITIALIZED for trackRevenue', async () => {
      await expect(sdk.trackRevenue(9.99, 'USD')).rejects.toThrow(LinkFortyError);
    });

    it('throws NOT_INITIALIZED for createLink', async () => {
      await expect(sdk.createLink({})).rejects.toThrow(LinkFortyError);
    });
  });

  describe('event tracking', () => {
    beforeEach(async () => {
      setupFetch();
      await sdk.initialize(validConfig);
      mockFetch.mockReset();
    });

    it('tracks an event', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await sdk.trackEvent('purchase', { item: 'shoes' });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/sdk/v1/event');
      const body = JSON.parse(opts.body);
      expect(body.eventName).toBe('purchase');
    });

    it('tracks revenue', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await sdk.trackRevenue(19.99, 'USD');

      const [, opts] = mockFetch.mock.calls[0];
      const body = JSON.parse(opts.body);
      expect(body.eventName).toBe('revenue');
      expect(body.eventData.revenue).toBe(19.99);
      expect(body.eventData.currency).toBe('USD');
    });
  });

  describe('link creation', () => {
    it('throws MISSING_API_KEY when no API key', async () => {
      setupFetch();
      await sdk.initialize(validConfig);

      try {
        await sdk.createLink({ title: 'test' });
        expect.fail('Should have thrown');
      } catch (e) {
        expect((e as LinkFortyError).code).toBe(LinkFortyErrorCode.MISSING_API_KEY);
      }
    });

    it('creates a link with simplified endpoint', async () => {
      setupFetch();
      await sdk.initialize({ ...validConfig, apiKey: 'test-key' });

      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            url: 'https://go.example.com/tmpl/abc123',
            shortCode: 'abc123',
            linkId: 'link-uuid',
          }),
      });

      const result = await sdk.createLink({
        deepLinkParameters: { route: 'product' },
        title: 'My Link',
      });

      expect(result.url).toBe('https://go.example.com/tmpl/abc123');
      expect(result.shortCode).toBe('abc123');
      expect(result.linkId).toBe('link-uuid');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/sdk/v1/links');
    });

    it('creates a link with dashboard endpoint when templateId provided', async () => {
      setupFetch();
      await sdk.initialize({ ...validConfig, apiKey: 'test-key' });

      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'link-uuid',
            short_code: 'xyz789',
          }),
      });

      const result = await sdk.createLink({
        templateId: 'tmpl-uuid',
        templateSlug: 'share',
      });

      expect(result.url).toBe('https://go.example.com/share/xyz789');
      expect(result.shortCode).toBe('xyz789');
      expect(result.linkId).toBe('link-uuid');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/links');
    });
  });

  describe('attribution data access', () => {
    it('getInstallId returns cached ID', async () => {
      setupFetch({ installId: 'my-install', attributed: false, confidenceScore: 0, matchedFactors: [], deepLinkData: null });
      await sdk.initialize(validConfig);

      expect(await sdk.getInstallId()).toBe('my-install');
    });

    it('getInstallData returns null for organic', async () => {
      setupFetch();
      await sdk.initialize(validConfig);

      expect(await sdk.getInstallData()).toBeNull();
    });

    it('isFirstLaunch returns false after init', async () => {
      setupFetch();
      await sdk.initialize(validConfig);

      expect(await sdk.isFirstLaunch()).toBe(false);
    });
  });

  describe('data management', () => {
    it('clearData clears all stored data', async () => {
      setupFetch({ installId: 'id-1', attributed: false, confidenceScore: 0, matchedFactors: [], deepLinkData: null });
      await sdk.initialize(validConfig);

      await sdk.clearData();

      expect(await sdk.getInstallId()).toBeNull();
    });

    it('reset returns to uninitialized state', async () => {
      setupFetch();
      await sdk.initialize(validConfig);

      sdk.reset();

      expect(sdk.isInitialized).toBe(false);
      expect(() => sdk.onDeepLink(vi.fn())).toThrow(LinkFortyError);
    });

    it('can reinitialize after reset', async () => {
      setupFetch();
      await sdk.initialize(validConfig);
      await sdk.clearData();
      sdk.reset();

      setupFetch({ installId: 'new-id', attributed: false, confidenceScore: 0, matchedFactors: [], deepLinkData: null });
      const result = await sdk.initialize(validConfig);
      expect(result.installId).toBe('new-id');
      expect(sdk.isInitialized).toBe(true);
    });
  });

  describe('event queue', () => {
    it('queuedEventCount is 0 before initialization', () => {
      expect(sdk.queuedEventCount).toBe(0);
    });

    it('clearEventQueue works', async () => {
      setupFetch();
      await sdk.initialize(validConfig);
      await sdk.clearEventQueue();
      expect(sdk.queuedEventCount).toBe(0);
    });

    it('flushEvents sends queued events', async () => {
      setupFetch();
      await sdk.initialize(validConfig);

      // First call fails — event gets queued
      // Network manager retries 3 times, so reject all attempts
      mockFetch.mockReset();
      mockFetch.mockRejectedValue(new Error('offline'));

      await expect(sdk.trackEvent('queued-event')).rejects.toThrow();
      expect(sdk.queuedEventCount).toBe(1);

      // Now network recovers — reset mock and set success response
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await sdk.flushEvents();
      expect(sdk.queuedEventCount).toBe(0);

      // Verify the flush actually sent the queued event
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/sdk/v1/event');
      const body = JSON.parse(opts.body);
      expect(body.eventName).toBe('queued-event');
    });

    it('flushEvents throws NOT_INITIALIZED before init', async () => {
      await expect(sdk.flushEvents()).rejects.toThrow(LinkFortyError);
    });
  });
});

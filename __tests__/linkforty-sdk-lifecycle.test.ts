import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as ReactNative from 'react-native';
import { LinkFortySDK } from '../src/linkforty-sdk';
import { LinkFortyErrorCode, type LinkFortyError } from '../src/errors/linkforty-error';
import { STORAGE_KEYS } from '../src/storage/storage-keys';
import type { LinkFortyConfig } from '../src/models/config';

const config: LinkFortyConfig = { baseUrl: 'https://go.example.com' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type Reply = { ok: boolean; status?: number; body?: unknown } | Error;

/** Routes fetch calls by path; a missing route answers `{}`. */
function routeFetch(routes: Record<string, () => Reply>) {
  return vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    const key = Object.keys(routes).find((prefix) => path.startsWith(prefix));
    const reply = key ? routes[key]() : { ok: true, body: {} };
    if (reply instanceof Error) throw reply;
    return {
      ok: reply.ok,
      status: reply.status ?? (reply.ok ? 200 : 500),
      json: () => Promise.resolve(reply.body ?? {}),
    };
  });
}

const organicInstall = (installId = 'install-1'): Reply => ({
  ok: true,
  body: { installId, attributed: false, confidenceScore: 0, matchedFactors: [], deepLinkData: null },
});

/** A failed install report that the network layer does not retry (keeps tests fast). */
const failedInstall = (): Reply => ({ ok: false, status: 400, body: { error: 'bad request' } });

function callsTo(fetchMock: ReturnType<typeof vi.fn>, path: string) {
  return fetchMock.mock.calls.filter(([url]) => new URL(url as string).pathname.startsWith(path));
}

function eventBodies(fetchMock: ReturnType<typeof vi.fn>) {
  return callsTo(fetchMock, '/api/sdk/v1/event').map(
    ([, opts]) => JSON.parse((opts as RequestInit).body as string) as Record<string, unknown>,
  );
}

const settle = () => new Promise((r) => setTimeout(r, 30));

const emitAppState = (state: string) =>
  (ReactNative as unknown as { __emitAppState: (s: string) => void }).__emitAppState(state);

describe('LinkFortySDK lifecycle', () => {
  let sdk: LinkFortySDK;

  beforeEach(async () => {
    await AsyncStorage.clear();
    vi.mocked(Linking.getInitialURL).mockResolvedValue(null);
    sdk = new LinkFortySDK();
  });

  afterEach(() => {
    sdk.reset();
  });

  /** A new process: a fresh SDK instance over the same storage. */
  function relaunch() {
    sdk.reset();
    sdk = new LinkFortySDK();
  }

  describe('the link that launched the app', () => {
    it('is delivered to the first onDeepLink callback registered after initialize', async () => {
      vi.mocked(Linking.getInitialURL).mockResolvedValue('https://go.example.com/abc123?ref=x');
      globalThis.fetch = routeFetch({
        '/api/sdk/v1/install': () => organicInstall(),
        '/api/sdk/v1/resolve': () => ({ ok: true, body: { shortCode: 'abc123', linkId: 'link-1' } }),
      }) as unknown as typeof fetch;

      await sdk.initialize(config);
      // The launch link is resolved before the app gets to register a callback.
      await settle();

      const callback = vi.fn();
      sdk.onDeepLink(callback);
      await settle();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        'https://go.example.com/abc123?ref=x',
        expect.objectContaining({ shortCode: 'abc123', linkId: 'link-1' }),
      );
    });

    it('is delivered once: a callback registered later does not receive it again', async () => {
      vi.mocked(Linking.getInitialURL).mockResolvedValue('https://other.example.org/page');
      globalThis.fetch = routeFetch({ '/api/sdk/v1/install': () => organicInstall() }) as unknown as typeof fetch;

      await sdk.initialize(config);
      await settle();

      const first = vi.fn();
      sdk.onDeepLink(first);
      await settle();
      const second = vi.fn();
      sdk.onDeepLink(second);
      await settle();

      expect(first).toHaveBeenCalledWith('https://other.example.org/page', null);
      expect(second).not.toHaveBeenCalled();
    });

    it('still sets last-click attribution before any callback is registered', async () => {
      vi.mocked(Linking.getInitialURL).mockResolvedValue('https://go.example.com/abc123');
      const fetchMock = routeFetch({
        '/api/sdk/v1/install': () => organicInstall(),
        '/api/sdk/v1/resolve': () => ({ ok: true, body: { shortCode: 'abc123', linkId: 'link-1' } }),
        '/api/sdk/v1/event': () => ({ ok: true, body: {} }),
      });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await sdk.initialize(config);
      await settle();
      await sdk.trackEvent('opened');

      expect(eventBodies(fetchMock)[0].attributedLinkId).toBe('link-1');
    });
  });

  describe('a failed install report', () => {
    it('is reported again on the next launch, which then delivers the deferred deep link', async () => {
      let installReply: () => Reply = failedInstall;
      const fetchMock = routeFetch({ '/api/sdk/v1/install': () => installReply() });
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      const first = await sdk.initialize(config);
      expect(first.attributed).toBe(false);
      expect(first.installId).toBe('');
      expect(await sdk.getInstallId()).toBeNull();
      expect(await sdk.isFirstLaunch()).toBe(true);
      // The first launch still answers its deferred callback, as organic.
      const firstDeferred = vi.fn();
      sdk.onDeferredDeepLink(firstDeferred);
      expect(firstDeferred).toHaveBeenCalledWith(null);

      relaunch();
      installReply = () => ({
        ok: true,
        body: {
          installId: 'install-2',
          attributed: true,
          confidenceScore: 90,
          matchedFactors: ['ip'],
          deepLinkData: { shortCode: 'promo', linkId: 'link-9' },
        },
      });
      const second = await sdk.initialize(config);
      const secondDeferred = vi.fn();
      sdk.onDeferredDeepLink(secondDeferred);

      expect(callsTo(fetchMock, '/api/sdk/v1/install')).toHaveLength(2);
      expect(second.installId).toBe('install-2');
      expect(await sdk.getInstallId()).toBe('install-2');
      expect(await sdk.isFirstLaunch()).toBe(false);
      expect(secondDeferred).toHaveBeenCalledWith(expect.objectContaining({ shortCode: 'promo' }));

      // Reported now: a third launch uses the saved install.
      relaunch();
      await sdk.initialize(config);
      expect(callsTo(fetchMock, '/api/sdk/v1/install')).toHaveLength(2);
    });

    it('leaves events rejected with NOT_INITIALIZED until the install is reported', async () => {
      globalThis.fetch = routeFetch({ '/api/sdk/v1/install': failedInstall }) as unknown as typeof fetch;
      await sdk.initialize(config);

      await expect(sdk.trackEvent('signup')).rejects.toSatisfy(
        (e) => (e as LinkFortyError).code === LinkFortyErrorCode.NOT_INITIALIZED,
      );
    });
  });

  describe('the offline event queue', () => {
    async function queueOneEvent(fetchMock: ReturnType<typeof vi.fn>, eventReply: { current: () => Reply }) {
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      await sdk.initialize(config);
      eventReply.current = () => ({ ok: false, status: 400 });
      await expect(sdk.trackEvent('purchase', { sku: 'a' })).rejects.toBeDefined();
      expect(sdk.queuedEventCount).toBe(1);
    }

    it('is sent on the next launch once the install is known', async () => {
      const eventReply = { current: (): Reply => ({ ok: true, body: {} }) };
      const fetchMock = routeFetch({
        '/api/sdk/v1/install': () => organicInstall(),
        '/api/sdk/v1/event': () => eventReply.current(),
      });
      await queueOneEvent(fetchMock, eventReply);

      relaunch();
      eventReply.current = () => ({ ok: true, body: {} });
      fetchMock.mockClear();
      await sdk.initialize(config);
      await settle();

      expect(eventBodies(fetchMock).map((e) => e.eventName)).toEqual(['purchase']);
      expect(sdk.queuedEventCount).toBe(0);
    });

    it('is sent when the app returns to the foreground', async () => {
      const eventReply = { current: (): Reply => ({ ok: true, body: {} }) };
      const fetchMock = routeFetch({
        '/api/sdk/v1/install': () => organicInstall(),
        '/api/sdk/v1/event': () => eventReply.current(),
      });
      await queueOneEvent(fetchMock, eventReply);

      eventReply.current = () => ({ ok: true, body: {} });
      fetchMock.mockClear();
      emitAppState('background');
      await settle();
      expect(eventBodies(fetchMock)).toHaveLength(0);

      emitAppState('active');
      await settle();
      expect(eventBodies(fetchMock).map((e) => e.eventName)).toEqual(['purchase']);
      expect(sdk.queuedEventCount).toBe(0);
    });

    it('stops listening for the foreground on reset', async () => {
      const fetchMock = routeFetch({ '/api/sdk/v1/install': () => organicInstall() });
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      await sdk.initialize(config);
      sdk.reset();

      const listeners = (ReactNative as unknown as { __appStateListeners: unknown[] }).__appStateListeners;
      expect(listeners).toHaveLength(0);
    });

    it('gives each event an id that stays the same when a queued event is sent again', async () => {
      const eventReply = { current: (): Reply => ({ ok: true, body: {} }) };
      const fetchMock = routeFetch({
        '/api/sdk/v1/install': () => organicInstall(),
        '/api/sdk/v1/event': () => eventReply.current(),
      });
      await queueOneEvent(fetchMock, eventReply);
      const [failedSend] = eventBodies(fetchMock);

      eventReply.current = () => ({ ok: true, body: {} });
      await sdk.flushEvents();
      const resent = eventBodies(fetchMock).at(-1)!;

      expect(failedSend.clientEventId).toMatch(UUID);
      expect(resent.clientEventId).toBe(failedSend.clientEventId);

      await sdk.trackEvent('another');
      const another = eventBodies(fetchMock).at(-1)!;
      expect(another.clientEventId).toMatch(UUID);
      expect(another.clientEventId).not.toBe(failedSend.clientEventId);
    });

    it('sends each queued event once when flushes overlap', async () => {
      const eventReply = { current: (): Reply => ({ ok: true, body: {} }) };
      const fetchMock = routeFetch({
        '/api/sdk/v1/install': () => organicInstall(),
        '/api/sdk/v1/event': () => eventReply.current(),
      });
      await queueOneEvent(fetchMock, eventReply);
      await expect(sdk.trackEvent('second')).rejects.toBeDefined();
      expect(sdk.queuedEventCount).toBe(2);

      eventReply.current = () => ({ ok: true, body: {} });
      fetchMock.mockClear();
      emitAppState('active');
      await Promise.all([sdk.flushEvents(), sdk.flushEvents()]);
      await settle();

      expect(eventBodies(fetchMock).map((e) => e.eventName)).toEqual(['purchase', 'second']);
      expect(sdk.queuedEventCount).toBe(0);
    });

    it('keeps queued events stored when the launch flush fails', async () => {
      const eventReply = { current: (): Reply => ({ ok: true, body: {} }) };
      const fetchMock = routeFetch({
        '/api/sdk/v1/install': () => organicInstall(),
        '/api/sdk/v1/event': () => eventReply.current(),
      });
      await queueOneEvent(fetchMock, eventReply);

      relaunch();
      await sdk.initialize(config);
      await settle();

      const stored = JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.EVENT_QUEUE))!);
      expect(stored).toHaveLength(1);
      expect(stored[0].eventName).toBe('purchase');
    });
  });
});

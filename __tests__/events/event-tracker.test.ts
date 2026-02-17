import { describe, it, expect, vi, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventTracker } from '../../src/events/event-tracker';
import { EventQueue } from '../../src/events/event-queue';
import { LinkFortyError, LinkFortyErrorCode } from '../../src/errors/linkforty-error';
import type { StorageManagerProtocol } from '../../src/storage/storage-manager';
import type { NetworkManagerProtocol } from '../../src/network/network-manager';

function createMockStorage(installId: string | null = 'install-1'): StorageManagerProtocol {
  return {
    saveInstallId: vi.fn(async () => {}),
    getInstallId: vi.fn(async () => installId),
    saveInstallData: vi.fn(async () => {}),
    getInstallData: vi.fn(async () => null),
    isFirstLaunch: vi.fn(async () => false),
    setHasLaunched: vi.fn(async () => {}),
    clearAll: vi.fn(async () => {}),
  };
}

function createMockNetwork(shouldFail = false): NetworkManagerProtocol {
  return {
    request: shouldFail
      ? vi.fn().mockRejectedValue(new Error('Network error'))
      : vi.fn(async () => ({ success: true })),
  };
}

describe('EventTracker', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('tracks an event successfully', async () => {
    const network = createMockNetwork();
    const storage = createMockStorage();
    const tracker = new EventTracker(network, storage);

    await tracker.trackEvent('purchase', { item: 'shoes' });

    expect(network.request).toHaveBeenCalledWith(
      '/api/sdk/v1/event',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    // Parse the body to verify structure
    const call = (network.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.installId).toBe('install-1');
    expect(body.eventName).toBe('purchase');
    expect(body.eventData).toEqual({ item: 'shoes' });
    expect(body.timestamp).toBeDefined();
  });

  it('throws on empty event name', async () => {
    const tracker = new EventTracker(createMockNetwork(), createMockStorage());

    await expect(tracker.trackEvent('')).rejects.toThrow(LinkFortyError);
    await expect(tracker.trackEvent('  ')).rejects.toThrow(LinkFortyError);
  });

  it('throws NOT_INITIALIZED when no install ID', async () => {
    const tracker = new EventTracker(createMockNetwork(), createMockStorage(null));

    try {
      await tracker.trackEvent('test');
      expect.fail('Should have thrown');
    } catch (e) {
      expect((e as LinkFortyError).code).toBe(LinkFortyErrorCode.NOT_INITIALIZED);
    }
  });

  it('queues event on network failure', async () => {
    const network = createMockNetwork(true);
    const queue = new EventQueue();
    const tracker = new EventTracker(network, createMockStorage(), queue);

    await expect(tracker.trackEvent('test')).rejects.toThrow();
    expect(queue.count).toBe(1);
  });

  it('tracks revenue event', async () => {
    const network = createMockNetwork();
    const tracker = new EventTracker(network, createMockStorage());

    await tracker.trackRevenue(9.99, 'USD', { product: 'premium' });

    const call = (network.request as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.eventName).toBe('revenue');
    expect(body.eventData.revenue).toBe(9.99);
    expect(body.eventData.currency).toBe('USD');
    expect(body.eventData.product).toBe('premium');
  });

  it('rejects negative revenue', async () => {
    const tracker = new EventTracker(createMockNetwork(), createMockStorage());
    await expect(tracker.trackRevenue(-1, 'USD')).rejects.toThrow(LinkFortyError);
  });

  it('flushes queued events', async () => {
    const queue = new EventQueue();
    await queue.enqueue({
      installId: 'install-1',
      eventName: 'queued',
      eventData: {},
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    const network = createMockNetwork();
    const tracker = new EventTracker(network, createMockStorage(), queue);

    await tracker.flushQueue();

    expect(network.request).toHaveBeenCalledTimes(1);
    expect(queue.count).toBe(0);
  });

  it('re-queues event when flush fails', async () => {
    const queue = new EventQueue();
    await queue.enqueue({
      installId: 'install-1',
      eventName: 'retry',
      eventData: {},
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    const network = createMockNetwork(true);
    const tracker = new EventTracker(network, createMockStorage(), queue);

    await tracker.flushQueue();

    expect(queue.count).toBe(1);
  });

  it('clearQueue empties the queue', async () => {
    const queue = new EventQueue();
    await queue.enqueue({
      installId: 'install-1',
      eventName: 'clear-me',
      eventData: {},
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    const tracker = new EventTracker(createMockNetwork(), createMockStorage(), queue);
    await tracker.clearQueue();
    expect(tracker.queuedEventCount).toBe(0);
  });

  it('queuedEventCount reflects queue size', async () => {
    const queue = new EventQueue();
    const tracker = new EventTracker(createMockNetwork(), createMockStorage(), queue);

    expect(tracker.queuedEventCount).toBe(0);

    await queue.enqueue({
      installId: 'install-1',
      eventName: 'a',
      eventData: {},
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    expect(tracker.queuedEventCount).toBe(1);
  });
});

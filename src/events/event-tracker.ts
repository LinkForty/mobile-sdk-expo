import type { NetworkManagerProtocol } from '../network/network-manager';
import type { StorageManagerProtocol } from '../storage/storage-manager';
import type { EventRequest } from '../models/event-request';
import { EventQueue } from './event-queue';
import { LinkFortyError } from '../errors/linkforty-error';
import { logger } from '../logger';

export class EventTracker {
  private readonly network: NetworkManagerProtocol;
  private readonly storage: StorageManagerProtocol;
  private readonly queue: EventQueue;

  constructor(
    network: NetworkManagerProtocol,
    storage: StorageManagerProtocol,
    queue?: EventQueue,
  ) {
    this.network = network;
    this.storage = storage;
    this.queue = queue ?? new EventQueue();
  }

  async trackEvent(name: string, properties?: Record<string, unknown>): Promise<void> {
    if (!name || !name.trim()) {
      throw LinkFortyError.invalidEventData('Event name cannot be empty');
    }

    const installId = await this.storage.getInstallId();
    if (!installId) {
      throw LinkFortyError.notInitialized();
    }

    const event: EventRequest = {
      installId,
      eventName: name,
      eventData: properties ?? {},
      timestamp: new Date().toISOString(),
    };

    try {
      await this.sendEvent(event);
      logger.log('Event tracked:', name);

      // If send succeeds, try to flush queued events
      await this.flushQueue();
    } catch (e) {
      // Queue the event on failure
      await this.queue.enqueue(event);
      logger.log('Event queued due to error:', e);
      throw e;
    }
  }

  async trackRevenue(
    amount: number,
    currency: string,
    properties?: Record<string, unknown>,
  ): Promise<void> {
    if (amount < 0) {
      throw LinkFortyError.invalidEventData('Revenue amount must be non-negative');
    }

    const eventProperties: Record<string, unknown> = {
      ...properties,
      revenue: amount,
      currency,
    };

    await this.trackEvent('revenue', eventProperties);
  }

  async flushQueue(): Promise<void> {
    await this.queue.load();
    logger.log(`Flushing event queue (${this.queue.count} events)`);

    while (!this.queue.isEmpty) {
      const event = await this.queue.dequeue();
      if (!event) break;

      try {
        await this.sendEvent(event);
        logger.log('Queued event sent:', event.eventName);
      } catch (e) {
        // Re-queue the event and stop flushing
        await this.queue.enqueue(event);
        logger.log('Failed to send queued event:', e);
        return;
      }
    }
  }

  async clearQueue(): Promise<void> {
    await this.queue.clear();
  }

  get queuedEventCount(): number {
    return this.queue.count;
  }

  private async sendEvent(event: EventRequest): Promise<void> {
    await this.network.request('/api/sdk/v1/event', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }
}

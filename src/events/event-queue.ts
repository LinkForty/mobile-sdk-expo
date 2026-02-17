import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EventRequest } from '../models/event-request';
import { STORAGE_KEYS } from '../storage/storage-keys';
import { logger } from '../logger';

const MAX_QUEUE_SIZE = 100;

export class EventQueue {
  private queue: EventRequest[] = [];
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.EVENT_QUEUE);
      if (json) {
        this.queue = JSON.parse(json) as EventRequest[];
      }
    } catch (e) {
      logger.error('Failed to load event queue:', e);
      this.queue = [];
    }
    this.loaded = true;
  }

  async enqueue(event: EventRequest): Promise<boolean> {
    await this.load();
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      logger.log('Event queue full, dropping event:', event.eventName);
      return false;
    }
    this.queue.push(event);
    await this.persist();
    logger.log(`Event queued: ${event.eventName} (queue size: ${this.queue.length})`);
    return true;
  }

  async dequeue(): Promise<EventRequest | null> {
    await this.load();
    if (this.queue.length === 0) return null;
    const event = this.queue.shift()!;
    await this.persist();
    return event;
  }

  async peek(): Promise<EventRequest[]> {
    await this.load();
    return [...this.queue];
  }

  async clear(): Promise<void> {
    const size = this.queue.length;
    this.queue = [];
    await this.persist();
    if (size > 0) {
      logger.log(`Event queue cleared (${size} events removed)`);
    }
  }

  get count(): number {
    return this.queue.length;
  }

  get isEmpty(): boolean {
    return this.queue.length === 0;
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.EVENT_QUEUE, JSON.stringify(this.queue));
    } catch (e) {
      logger.error('Failed to persist event queue:', e);
    }
  }
}

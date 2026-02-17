import { describe, it, expect, vi, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventQueue } from '../../src/events/event-queue';
import type { EventRequest } from '../../src/models/event-request';

function makeEvent(name: string): EventRequest {
  return {
    installId: 'install-1',
    eventName: name,
    eventData: {},
    timestamp: '2026-01-01T00:00:00.000Z',
  };
}

describe('EventQueue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('starts empty', async () => {
    const queue = new EventQueue();
    await queue.load();
    expect(queue.count).toBe(0);
    expect(queue.isEmpty).toBe(true);
  });

  it('enqueues and dequeues events in FIFO order', async () => {
    const queue = new EventQueue();
    await queue.enqueue(makeEvent('first'));
    await queue.enqueue(makeEvent('second'));

    expect(queue.count).toBe(2);

    const first = await queue.dequeue();
    expect(first!.eventName).toBe('first');

    const second = await queue.dequeue();
    expect(second!.eventName).toBe('second');

    expect(queue.isEmpty).toBe(true);
  });

  it('returns null when dequeuing from empty queue', async () => {
    const queue = new EventQueue();
    const result = await queue.dequeue();
    expect(result).toBeNull();
  });

  it('enforces max queue size of 100', async () => {
    const queue = new EventQueue();
    for (let i = 0; i < 100; i++) {
      const added = await queue.enqueue(makeEvent(`event-${i}`));
      expect(added).toBe(true);
    }

    expect(queue.count).toBe(100);

    const added = await queue.enqueue(makeEvent('overflow'));
    expect(added).toBe(false);
    expect(queue.count).toBe(100);
  });

  it('persists across instances via AsyncStorage', async () => {
    const queue1 = new EventQueue();
    await queue1.enqueue(makeEvent('persisted'));

    // New instance should load from storage
    const queue2 = new EventQueue();
    await queue2.load();
    expect(queue2.count).toBe(1);

    const event = await queue2.dequeue();
    expect(event!.eventName).toBe('persisted');
  });

  it('peek returns copy without removing', async () => {
    const queue = new EventQueue();
    await queue.enqueue(makeEvent('peek-me'));

    const peeked = await queue.peek();
    expect(peeked).toHaveLength(1);
    expect(peeked[0].eventName).toBe('peek-me');
    expect(queue.count).toBe(1);
  });

  it('clears all events', async () => {
    const queue = new EventQueue();
    await queue.enqueue(makeEvent('a'));
    await queue.enqueue(makeEvent('b'));

    await queue.clear();
    expect(queue.count).toBe(0);
    expect(queue.isEmpty).toBe(true);
  });

  it('handles corrupted AsyncStorage data gracefully on load', async () => {
    // Write invalid JSON to the queue key
    await AsyncStorage.setItem('@linkforty:event_queue', '{not valid json');

    const queue = new EventQueue();
    await queue.load();

    // Should reset to empty rather than throw
    expect(queue.count).toBe(0);
    expect(queue.isEmpty).toBe(true);
  });

  it('handles AsyncStorage.getItem throwing on load', async () => {
    vi.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Storage unavailable'));

    const queue = new EventQueue();
    await queue.load();

    expect(queue.count).toBe(0);
    expect(queue.isEmpty).toBe(true);
  });
});

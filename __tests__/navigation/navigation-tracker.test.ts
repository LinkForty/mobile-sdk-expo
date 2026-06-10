import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NavigationTracker,
  sanitizeScreenParams,
} from '../../src/navigation/navigation-tracker';
import type {
  NavigationContainerRefLike,
  NavigationRouteLike,
} from '../../src/models/config';

function createFakeNavRef(initial?: NavigationRouteLike) {
  let current = initial;
  let listener: (() => void) | null = null;
  const ref: NavigationContainerRefLike = {
    addListener: (_type, cb) => {
      listener = cb as () => void;
      return () => {
        listener = null;
      };
    },
    getCurrentRoute: () => current,
    isReady: () => true,
  };
  return {
    ref,
    navigateTo(route: NavigationRouteLike) {
      current = route;
      listener?.();
    },
    hasListener: () => listener !== null,
  };
}

describe('sanitizeScreenParams', () => {
  it('captures only allow-listed keys, keeps primitives, caps long strings', () => {
    const out = sanitizeScreenParams(
      {
        productId: 'abc',
        qty: 3,
        featured: true,
        nested: { a: 1 },
        long: 'x'.repeat(500),
        secretValue: 'should-not-appear',
      },
      ['productId', 'qty', 'featured', 'nested', 'long'],
    );
    expect(out).toEqual({
      productId: 'abc',
      qty: 3,
      featured: true,
      long: 'x'.repeat(256),
    });
  });

  it('returns undefined with no/empty allow-list (params are off by default)', () => {
    expect(sanitizeScreenParams({ productId: 'abc' }, undefined)).toBeUndefined();
    expect(sanitizeScreenParams({ productId: 'abc' }, [])).toBeUndefined();
  });

  it('returns undefined when no allow-listed key survives', () => {
    expect(sanitizeScreenParams({ nested: { a: 1 } }, ['nested'])).toBeUndefined();
    expect(sanitizeScreenParams(undefined, ['x'])).toBeUndefined();
  });
});

describe('NavigationTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits screen_view for the initial screen on start', () => {
    const emit = vi.fn();
    const nav = createFakeNavRef({ name: 'Home' });
    const tracker = new NavigationTracker(nav.ref, emit, { debounceMs: 300 });

    tracker.start();

    expect(emit).toHaveBeenCalledWith('screen_view', { screen: 'Home' });
  });

  it('emits on navigation with previousScreen, after the debounce — no params by default', () => {
    const emit = vi.fn();
    const nav = createFakeNavRef({ name: 'Home' });
    const tracker = new NavigationTracker(nav.ref, emit, { debounceMs: 300 });
    tracker.start();
    emit.mockClear();

    nav.navigateTo({ name: 'Product', params: { productId: 'p1' } });
    expect(emit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(emit).toHaveBeenCalledWith('screen_view', {
      screen: 'Product',
      previousScreen: 'Home',
    });
  });

  it('debounces rapid transitions to the final screen only', () => {
    const emit = vi.fn();
    const nav = createFakeNavRef({ name: 'Home' });
    const tracker = new NavigationTracker(nav.ref, emit, { debounceMs: 300 });
    tracker.start();
    emit.mockClear();

    nav.navigateTo({ name: 'A' });
    vi.advanceTimersByTime(100);
    nav.navigateTo({ name: 'B' });
    vi.advanceTimersByTime(100);
    nav.navigateTo({ name: 'C' });
    vi.advanceTimersByTime(300);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('screen_view', { screen: 'C', previousScreen: 'Home' });
  });

  it('dedupes: a state change that stays on the same screen emits nothing', () => {
    const emit = vi.fn();
    const nav = createFakeNavRef({ name: 'Home' });
    const tracker = new NavigationTracker(nav.ref, emit, { debounceMs: 300 });
    tracker.start();
    emit.mockClear();

    nav.navigateTo({ name: 'Home', params: { tab: 2 } });
    vi.advanceTimersByTime(300);

    expect(emit).not.toHaveBeenCalled();
  });

  it('captures only allow-listed params when captureParams is set', () => {
    const emit = vi.fn();
    const nav = createFakeNavRef({ name: 'Home' });
    const tracker = new NavigationTracker(nav.ref, emit, {
      debounceMs: 300,
      captureParams: ['productId'],
    });
    tracker.start();
    emit.mockClear();

    nav.navigateTo({ name: 'Product', params: { productId: 'p1', referrerEmail: 'a@b.com' } });
    vi.advanceTimersByTime(300);

    expect(emit).toHaveBeenCalledWith('screen_view', {
      screen: 'Product',
      previousScreen: 'Home',
      params: { productId: 'p1' },
    });
  });

  it('stop() unsubscribes and prevents further emits', () => {
    const emit = vi.fn();
    const nav = createFakeNavRef({ name: 'Home' });
    const tracker = new NavigationTracker(nav.ref, emit, { debounceMs: 300 });
    tracker.start();
    emit.mockClear();

    tracker.stop();
    expect(nav.hasListener()).toBe(false);

    nav.navigateTo({ name: 'Product' });
    vi.advanceTimersByTime(300);
    expect(emit).not.toHaveBeenCalled();
  });

  it('is a no-op (no throw) when the navigationRef is malformed', () => {
    const emit = vi.fn();
    const badRef = {} as unknown as NavigationContainerRefLike;
    const tracker = new NavigationTracker(badRef, emit);

    expect(() => tracker.start()).not.toThrow();
    expect(emit).not.toHaveBeenCalled();
  });
});

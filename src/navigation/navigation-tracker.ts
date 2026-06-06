/**
 * NavigationTracker — auto-emits `screen_view` events from React Navigation.
 *
 * When `autoTrackNavigation` is enabled with a `navigationRef`, the SDK
 * subscribes to React Navigation's `'state'` event and emits a `screen_view`
 * for the active route on each change — debounced (rapid transitions collapse to
 * the final screen) and deduped (re-renders that don't change the screen are
 * ignored). The event flows through the normal event pipeline, so it carries the
 * active deep-link attribution context + session.
 *
 * Fully guarded: a missing/malformed `navigationRef` (or an app that doesn't use
 * react-navigation) is a no-op, never a crash. The ref is typed structurally so
 * there is no compile-time dependency on `@react-navigation/native`.
 */

import type { NavigationContainerRefLike, NavigationRouteLike } from '../models/config';
import { logger } from '../logger';

/** Emit function the tracker calls — bound to the SDK's `trackEvent`. */
export type ScreenEventEmitter = (
  name: string,
  properties: Record<string, unknown>,
) => void;

export interface NavigationTrackerOptions {
  /** Collapse rapid transitions; emit only the settled screen. Default 350ms. */
  debounceMs?: number;
  /**
   * Explicit allow-list of route param keys whose primitive values may be
   * captured. Omitted/empty = capture NO params (screen name only) — the
   * privacy-safe default.
   */
  captureParams?: string[];
}

const DEFAULT_DEBOUNCE_MS = 350;
const SCREEN_VIEW_EVENT = 'screen_view';
const MAX_PARAM_STRING_LENGTH = 256;

/**
 * Reduce route params to a safe, flat set limited to an explicit allow-list of
 * keys: only allow-listed keys are considered, and only primitive values
 * survive (strings capped, nested objects/arrays/functions dropped). Returns
 * undefined when nothing survives (including an empty/omitted allow-list).
 */
export function sanitizeScreenParams(
  params: Record<string, unknown> | undefined,
  allowList: string[] | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!params || typeof params !== 'object' || !allowList || allowList.length === 0) {
    return undefined;
  }

  const allowed = new Set(allowList);
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (!allowed.has(key)) continue;
    if (typeof value === 'string') {
      out[key] =
        value.length > MAX_PARAM_STRING_LENGTH ? value.slice(0, MAX_PARAM_STRING_LENGTH) : value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export class NavigationTracker {
  private readonly navigationRef: NavigationContainerRefLike;
  private readonly emit: ScreenEventEmitter;
  private readonly debounceMs: number;
  private readonly captureParams: string[] | undefined;

  private unsubscribe: (() => void) | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastScreen: string | null = null;
  private started = false;

  constructor(
    navigationRef: NavigationContainerRefLike,
    emit: ScreenEventEmitter,
    options: NavigationTrackerOptions = {},
  ) {
    this.navigationRef = navigationRef;
    this.emit = emit;
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.captureParams = options.captureParams;
  }

  /** Subscribe to navigation changes. No-op if the ref is malformed. Idempotent. */
  start(): void {
    if (this.started) return;

    if (
      !this.navigationRef ||
      typeof this.navigationRef.addListener !== 'function' ||
      typeof this.navigationRef.getCurrentRoute !== 'function'
    ) {
      logger.warn(
        'autoTrackNavigation enabled but navigationRef is missing or not a React Navigation container ref — screen tracking is disabled.',
      );
      return;
    }

    try {
      const listener = this.navigationRef.addListener('state', () => {
        this.scheduleCapture();
      });

      if (typeof listener === 'function') {
        this.unsubscribe = listener;
      } else if (listener && typeof listener.remove === 'function') {
        this.unsubscribe = () => listener.remove?.();
      } else {
        this.unsubscribe = null;
      }

      this.started = true;

      const ready =
        typeof this.navigationRef.isReady === 'function' ? this.navigationRef.isReady() : true;
      if (ready) {
        this.captureCurrentScreen();
      }

      logger.log('Navigation tracking started');
    } catch (e) {
      logger.warn('Failed to start navigation tracking:', e);
    }
  }

  /** Unsubscribe and clear any pending debounce. Idempotent. */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.unsubscribe) {
      try {
        this.unsubscribe();
      } catch {
        // ignore teardown errors
      }
      this.unsubscribe = null;
    }
    this.started = false;
    this.lastScreen = null;
  }

  private scheduleCapture(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.captureCurrentScreen();
    }, this.debounceMs);
  }

  private captureCurrentScreen(): void {
    let route: NavigationRouteLike | undefined;
    try {
      route = this.navigationRef.getCurrentRoute();
    } catch (e) {
      logger.warn('getCurrentRoute failed:', e);
      return;
    }

    if (!route || !route.name) return;

    // Dedupe: ignore state changes that don't move to a different screen.
    if (route.name === this.lastScreen) return;

    const previousScreen = this.lastScreen;
    this.lastScreen = route.name;

    const properties: Record<string, unknown> = { screen: route.name };
    if (previousScreen) {
      properties.previousScreen = previousScreen;
    }
    if (this.captureParams && this.captureParams.length > 0) {
      const params = sanitizeScreenParams(route.params, this.captureParams);
      if (params) {
        properties.params = params;
      }
    }

    try {
      this.emit(SCREEN_VIEW_EVENT, properties);
    } catch (e) {
      logger.warn('Failed to emit screen_view:', e);
    }
  }
}

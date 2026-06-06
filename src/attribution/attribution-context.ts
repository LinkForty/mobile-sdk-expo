/**
 * AttributionContext — last-click attribution + session tracking (SIT-237).
 *
 * Mirrors the React Native SDK. Every deep-link open (deferred install OR direct
 * re-engagement) pins an active attribution context to THAT link; the newest
 * open supersedes the previous one. Every tracked event is stamped with the
 * active context + a session id so the backend can credit the link under a
 * last-click + window model. The active context is persisted so a reopen without
 * a new click still attributes to the last link; the session is in-memory (a cold
 * start is a new session).
 *
 * Uses AsyncStorage directly (not StorageManager) to stay self-contained.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../storage/storage-keys';
import type { ActiveAttribution, AttributionStamp } from '../models/attribution';
import { logger } from '../logger';

/**
 * RFC4122-v4-style id for session grouping. Not a security token — `Math.random`
 * is sufficient and avoids a native crypto dependency.
 */
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class AttributionContext {
  private active: ActiveAttribution | null = null;
  private sessionId: string;
  private loaded = false;

  constructor() {
    // Construction == cold start == a new session.
    this.sessionId = generateSessionId();
  }

  /** Restore the persisted active context. Idempotent; never throws. */
  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.ATTRIBUTION);
      if (raw) {
        this.active = JSON.parse(raw) as ActiveAttribution;
      }
    } catch (e) {
      logger.warn('Failed to load attribution context:', e);
    }
    this.loaded = true;
  }

  /**
   * Record a deep-link open. Newest open supersedes (last-click) and starts a new
   * session. No-op when no `linkId` is known (organic open).
   */
  async recordDeepLinkOpen(linkId?: string | null, clickId?: string | null): Promise<void> {
    if (!linkId) return;

    this.active = {
      linkId,
      clickId: clickId ?? undefined,
      openedAt: new Date().toISOString(),
    };
    this.sessionId = generateSessionId();

    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ATTRIBUTION, JSON.stringify(this.active));
    } catch (e) {
      logger.warn('Failed to persist attribution context:', e);
    }
    logger.log('Attribution context set:', this.active, 'session:', this.sessionId);
  }

  /** Fields to merge into every event payload. */
  getStamp(): AttributionStamp {
    return {
      attributedLinkId: this.active?.linkId,
      attributedClickId: this.active?.clickId,
      linkOpenedAt: this.active?.openedAt,
      sessionId: this.sessionId,
    };
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getActive(): ActiveAttribution | null {
    return this.active;
  }

  /** Clear the persisted context and start a fresh session. */
  async clear(): Promise<void> {
    this.active = null;
    this.sessionId = generateSessionId();
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ATTRIBUTION);
    } catch (e) {
      logger.warn('Failed to clear attribution context:', e);
    }
  }
}

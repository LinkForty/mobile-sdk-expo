import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { logger } from '../logger';

/** Reads the install referrer: null when there is none. Never rejects. */
export type InstallReferrerReader = () => Promise<string | null>;

/** How long the install report waits for Play, retry included. */
export const INSTALL_REFERRER_TIMEOUT_MS = 2000;

/** The pause before asking Play again. */
const RETRY_DELAY_MS = 250;

const TIMED_OUT = Symbol('timed out');

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Reads the referrer Google Play recorded for this install, on Android. A
 * LinkForty link puts its click id in the referrer of every Play listing it
 * sends a visitor to, so the server can match the install to that click
 * exactly.
 *
 * Resolves null on iOS, without Play (another store, a sideload), when Play
 * doesn't answer within the timeout, and on any error: the install is then
 * matched by fingerprint. A failed read is tried once more within the timeout.
 */
export function createPlayInstallReferrerReader(
  read: () => Promise<string> = () => Application.getInstallReferrerAsync(),
  timeoutMs: number = INSTALL_REFERRER_TIMEOUT_MS,
): InstallReferrerReader {
  return async () => {
    if (Platform.OS !== 'android') return null;
    const deadline = Date.now() + timeoutMs;
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      try {
        const value = await withTimeout(read(), remaining);
        if (value === TIMED_OUT) {
          logger.log('Play install referrer: no answer in time');
          return null;
        }
        return typeof value === 'string' && value.trim() !== '' ? value : null;
      } catch (e) {
        logger.log('Play install referrer unavailable:', e);
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(RETRY_DELAY_MS, deadline - Date.now()))));
        }
      }
    }
    return null;
  };
}

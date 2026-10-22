import type { UTMParameters } from './utm-parameters';

/**
 * How an install was attributed: `'install_referrer'` when the Google Play
 * install referrer named the click, `'fingerprint'` when device signals matched
 * one, `'none'` when organic.
 */
export type AttributionMethod = 'install_referrer' | 'fingerprint' | 'none' | (string & {});

export interface DeepLinkData {
  shortCode: string;
  iosUrl?: string;
  androidUrl?: string;
  webUrl?: string;
  utmParameters?: UTMParameters;
  customParameters?: Record<string, string>;
  deepLinkPath?: string;
  appScheme?: string;
  clickedAt?: string;
  linkId?: string;
  // The four install-match fields below are set only on a deferred deep link
  // (an install matched to a click), and only when the server sends them; a
  // direct open never carries them.

  /** Match confidence score (0-100). */
  confidenceScore?: number;
  /** Fingerprint factors that matched (e.g. `['ip', 'user_agent', 'timezone']`). */
  matchedFactors?: string[];
  /** How the install was attributed: `'install_referrer'` or `'fingerprint'`. */
  attributionMethod?: AttributionMethod;
  /**
   * How many other links had a click from the install's network that also
   * reached the confidence threshold; 0 means no other link was in contention.
   * Above 0, another device's tap may be what led to this install, so an app
   * acting on a sensitive link (sign-in, gift) can treat the match as
   * unverified, for example by asking the user to confirm.
   */
  competingLinks?: number;
}

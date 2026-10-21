import type { AttributionMethod, DeepLinkData } from './deep-link-data';

export interface InstallAttributionResponse {
  installId: string;
  attributed: boolean;
  confidenceScore: number;
  matchedFactors: string[];
  deepLinkData: DeepLinkData | null;
  /**
   * How the install was attributed: `'fingerprint'` when matched to a click,
   * `'none'` when organic. Undefined when the server does not send it, and on
   * launches after the install's, which return the cached attribution.
   */
  attributionMethod?: AttributionMethod;
  /**
   * How many other links had a click from the install's network that also
   * reached the confidence threshold; 0 means no other link was in contention.
   * Above 0, another device's tap may be what led to this install, so an app
   * acting on a sensitive link (sign-in, gift) can treat the match as
   * unverified, for example by asking the user to confirm. Undefined when the
   * server does not send it, and on launches after the install's.
   */
  competingLinks?: number;
}

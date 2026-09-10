import type { DeepLinkData } from '../models/deep-link-data';
import type { UTMParameters } from '../models/utm-parameters';

interface ParsedUrl {
  pathname: string;
  searchParams: Map<string, string>;
}

/**
 * Hermes-safe URL parsing (URL.pathname may throw "not implemented" in Hermes).
 */
export function parseUrlString(url: string): ParsedUrl | null {
  try {
    const protocolEnd = url.indexOf('://');
    if (protocolEnd === -1) return null;

    const afterProtocol = url.substring(protocolEnd + 3);
    const pathStart = afterProtocol.indexOf('/');
    const pathAndQuery = pathStart === -1 ? '/' : afterProtocol.substring(pathStart);

    const hashIndex = pathAndQuery.indexOf('#');
    const withoutHash = hashIndex === -1 ? pathAndQuery : pathAndQuery.substring(0, hashIndex);

    const queryStart = withoutHash.indexOf('?');
    const pathname = queryStart === -1 ? withoutHash : withoutHash.substring(0, queryStart);
    const queryString = queryStart === -1 ? '' : withoutHash.substring(queryStart + 1);

    const searchParams = new Map<string, string>();
    if (queryString) {
      for (const pair of queryString.split('&')) {
        const eqIndex = pair.indexOf('=');
        if (eqIndex === -1) {
          searchParams.set(decodeURIComponent(pair), '');
        } else {
          searchParams.set(
            decodeURIComponent(pair.substring(0, eqIndex)),
            decodeURIComponent(pair.substring(eqIndex + 1)),
          );
        }
      }
    }

    return { pathname, searchParams };
  } catch {
    return null;
  }
}

export function buildQueryString(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
}

/**
 * Names LinkForty consumes, which are never a custom parameter:
 *   utm_*    surfaced separately as utmParameters
 *   fp_*     fingerprint signals the SDK appends when resolving a link, and
 *            which the redirect reads server-side for attribution
 *   lf_click the click id the redirect appends to a destination URL
 *
 * Mirrors the server's own filter so a direct open and a deferred install agree
 * on what reaches the app. A tapped short link would not normally carry the last
 * two, but the URL is public and anyone can append them.
 */
function isReservedParam(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.startsWith('utm_') || lower.startsWith('fp_') || lower === 'lf_click';
}

/**
 * Overlay the parameters from the opened URL onto the server's payload.
 *
 * Resolving a short code returns the link's *stored* configuration; the server
 * cannot know what was appended to the URL that was actually tapped. The SDK
 * does, having just parsed it. Without this a link shared as `?slug=titanic`
 * reaches the app with that value missing on a direct open, while the same link
 * after a deferred install carries it — the server merges the click's parameters
 * there. This applies the same rule where no click row exists.
 *
 * URL values win on a collision, matching that server-side precedence. Only
 * `customParameters` is merged: `linkId`, `deepLinkPath`, `appScheme`, the store
 * URLs and `utmParameters` are server truth a local parse cannot know.
 */
export function mergeUrlParameters(
  resolved: DeepLinkData,
  fromUrl: Record<string, string> | undefined,
): DeepLinkData {
  if (!fromUrl || Object.keys(fromUrl).length === 0) return resolved;
  return {
    ...resolved,
    customParameters: { ...(resolved.customParameters ?? {}), ...fromUrl },
  };
}

export function parseDeepLinkUrl(url: string, baseUrl?: string): DeepLinkData | null {
  // If baseUrl is set, only parse URLs matching it
  if (baseUrl && !url.startsWith(baseUrl)) {
    return null;
  }

  const parsed = parseUrlString(url);
  if (!parsed) return null;

  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  const shortCode = pathSegments[pathSegments.length - 1];
  if (!shortCode) return null;

  // Extract UTM parameters
  const utmParameters: UTMParameters = {};
  let hasUtm = false;
  for (const [key, value] of parsed.searchParams) {
    if (key === 'utm_source') { utmParameters.source = value; hasUtm = true; }
    else if (key === 'utm_medium') { utmParameters.medium = value; hasUtm = true; }
    else if (key === 'utm_campaign') { utmParameters.campaign = value; hasUtm = true; }
    else if (key === 'utm_term') { utmParameters.term = value; hasUtm = true; }
    else if (key === 'utm_content') { utmParameters.content = value; hasUtm = true; }
  }

  // Extract custom (non-UTM) parameters
  const customParameters: Record<string, string> = {};
  let hasCustom = false;
  for (const [key, value] of parsed.searchParams) {
    if (!isReservedParam(key)) {
      customParameters[key] = value;
      hasCustom = true;
    }
  }

  return {
    shortCode,
    utmParameters: hasUtm ? utmParameters : undefined,
    customParameters: hasCustom ? customParameters : undefined,
  };
}

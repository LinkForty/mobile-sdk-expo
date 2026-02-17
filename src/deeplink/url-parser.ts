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

const UTM_KEYS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']);

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
    if (!UTM_KEYS.has(key)) {
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

import { describe, it, expect } from 'vitest';
import { parseUrlString, buildQueryString, parseDeepLinkUrl, mergeUrlParameters } from '../../src/deeplink/url-parser';
import type { DeepLinkData } from '../../src/models/deep-link-data';

describe('parseUrlString', () => {
  it('parses a simple URL', () => {
    const result = parseUrlString('https://go.example.com/abc123');
    expect(result).not.toBeNull();
    expect(result!.pathname).toBe('/abc123');
    expect(result!.searchParams.size).toBe(0);
  });

  it('parses URL with query parameters', () => {
    const result = parseUrlString('https://go.example.com/abc?utm_source=google&key=value');
    expect(result!.pathname).toBe('/abc');
    expect(result!.searchParams.get('utm_source')).toBe('google');
    expect(result!.searchParams.get('key')).toBe('value');
  });

  it('parses URL with hash', () => {
    const result = parseUrlString('https://go.example.com/abc#section');
    expect(result!.pathname).toBe('/abc');
  });

  it('handles encoded query params', () => {
    const result = parseUrlString('https://go.example.com/abc?name=hello%20world');
    expect(result!.searchParams.get('name')).toBe('hello world');
  });

  it('parses template slug URLs', () => {
    const result = parseUrlString('https://go.example.com/tmpl/abc123');
    expect(result!.pathname).toBe('/tmpl/abc123');
  });

  it('returns null for invalid URL', () => {
    expect(parseUrlString('not-a-url')).toBeNull();
  });

  it('handles URL with no path', () => {
    const result = parseUrlString('https://go.example.com');
    expect(result).not.toBeNull();
    expect(result!.pathname).toBe('/');
  });

  it('handles query params without value', () => {
    const result = parseUrlString('https://go.example.com/abc?flag');
    expect(result!.searchParams.get('flag')).toBe('');
  });
});

describe('buildQueryString', () => {
  it('builds a query string from params', () => {
    const qs = buildQueryString({ fp_tz: 'America/New_York', fp_lang: 'en-US' });
    expect(qs).toContain('fp_tz=America%2FNew_York');
    expect(qs).toContain('fp_lang=en-US');
  });

  it('returns empty string for empty params', () => {
    expect(buildQueryString({})).toBe('');
  });
});

describe('parseDeepLinkUrl', () => {
  it('parses a simple LinkForty URL', () => {
    const result = parseDeepLinkUrl('https://go.example.com/abc123', 'https://go.example.com');
    expect(result).not.toBeNull();
    expect(result!.shortCode).toBe('abc123');
  });

  it('parses a template URL', () => {
    const result = parseDeepLinkUrl('https://go.example.com/tmpl/abc123', 'https://go.example.com');
    expect(result!.shortCode).toBe('abc123');
  });

  it('extracts UTM parameters', () => {
    const result = parseDeepLinkUrl(
      'https://go.example.com/abc?utm_source=google&utm_medium=cpc&utm_campaign=summer',
      'https://go.example.com',
    );
    expect(result!.utmParameters).toEqual({
      source: 'google',
      medium: 'cpc',
      campaign: 'summer',
    });
  });

  it('extracts custom parameters', () => {
    const result = parseDeepLinkUrl(
      'https://go.example.com/abc?route=product&id=42',
      'https://go.example.com',
    );
    expect(result!.customParameters).toEqual({ route: 'product', id: '42' });
    expect(result!.utmParameters).toBeUndefined();
  });

  it('separates UTM from custom params', () => {
    const result = parseDeepLinkUrl(
      'https://go.example.com/abc?utm_source=fb&custom=value',
      'https://go.example.com',
    );
    expect(result!.utmParameters!.source).toBe('fb');
    expect(result!.customParameters!['custom']).toBe('value');
  });

  it('returns null for non-matching baseUrl', () => {
    const result = parseDeepLinkUrl('https://other.com/abc', 'https://go.example.com');
    expect(result).toBeNull();
  });

  it('works without baseUrl (parses any URL)', () => {
    const result = parseDeepLinkUrl('https://anything.com/abc123');
    expect(result!.shortCode).toBe('abc123');
  });

  it('returns null for URL with no path segments', () => {
    const result = parseDeepLinkUrl('https://go.example.com/', 'https://go.example.com');
    expect(result).toBeNull();
  });
});

const BASE = 'https://go.example.com';
const resolved = (over: Partial<DeepLinkData> = {}): DeepLinkData =>
  ({ shortCode: 'abc123', ...over }) as DeepLinkData;

describe('parseDeepLinkUrl — reserved names', () => {
  it('keeps ordinary parameters as customParameters', () => {
    const d = parseDeepLinkUrl(`${BASE}/abc123?slug=titanic&promo=new-year`, BASE);
    expect(d?.customParameters).toEqual({ slug: 'titanic', promo: 'new-year' });
  });

  it('drops the names LinkForty consumes', () => {
    // utm_* is surfaced as utmParameters; fp_* is a fingerprint signal read
    // server-side; lf_click is the id appended to a destination URL. None of
    // them is the app's data, and the server excludes them too.
    const d = parseDeepLinkUrl(
      `${BASE}/abc123?slug=titanic&utm_source=ig&fp_tz=UTC&lf_click=abc`,
      BASE,
    );
    expect(d?.customParameters).toEqual({ slug: 'titanic' });
  });

  it('matches reserved names case-insensitively', () => {
    const d = parseDeepLinkUrl(`${BASE}/abc123?UTM_Source=ig&FP_TZ=UTC&LF_Click=x`, BASE);
    expect(d?.customParameters).toBeUndefined();
  });

  it('still surfaces UTM values under utmParameters', () => {
    const d = parseDeepLinkUrl(`${BASE}/abc123?utm_source=instagram`, BASE);
    expect(d?.utmParameters?.source).toBe('instagram');
  });
});

describe('mergeUrlParameters', () => {
  it('adds URL parameters when the link configures none', () => {
    expect(mergeUrlParameters(resolved(), { slug: 'titanic' }).customParameters)
      .toEqual({ slug: 'titanic' });
  });

  it('lets a URL parameter override a configured one', () => {
    const out = mergeUrlParameters(
      resolved({ customParameters: { slug: 'default', keep: 'me' } }),
      { slug: 'titanic' },
    );
    expect(out.customParameters).toEqual({ slug: 'titanic', keep: 'me' });
  });

  it('returns the payload untouched when the URL carried nothing', () => {
    const input = resolved({ customParameters: { a: '1' } });
    expect(mergeUrlParameters(input, undefined)).toBe(input);
    expect(mergeUrlParameters(input, {})).toBe(input);
  });

  it('never overwrites fields only the server knows', () => {
    const input = resolved({ linkId: 'l1', deepLinkPath: '/p/1', appScheme: 'myapp' });
    const out = mergeUrlParameters(input, { slug: 'titanic' });
    expect(out.linkId).toBe('l1');
    expect(out.deepLinkPath).toBe('/p/1');
    expect(out.appScheme).toBe('myapp');
  });
});

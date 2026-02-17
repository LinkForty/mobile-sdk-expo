import { describe, it, expect } from 'vitest';
import { parseUrlString, buildQueryString, parseDeepLinkUrl } from '../../src/deeplink/url-parser';

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

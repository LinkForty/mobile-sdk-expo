import { describe, it, expect } from 'vitest';
import { normalizeLanguageTag, languageFromLocale } from '../../src/fingerprint/language-tag';

describe('normalizeLanguageTag', () => {
  it.each([
    ['en-US', 'en-US'],
    ['en', 'en'],
    ['es-419', 'es-419'],
    ['fil-PH', 'fil-PH'],
    // Android toLanguageTag() with regional preferences
    ['en-ES-u-fw-mon-mu-celsius', 'en-ES'],
    ['de-DE-u-mu-fahrenhe', 'de-DE'],
    // Script subtags
    ['zh-Hans-CN', 'zh-CN'],
    ['yue-Hant-HK', 'yue-HK'],
    // ICU keywords and POSIX names
    ['en_GB@rg=eszzzz', 'en-GB'],
    ['en_US.UTF-8', 'en-US'],
    // Java Locale.toString() extensions
    ['en_ES_#u-fw-mon', 'en-ES'],
    ['ca-ES-valencia', 'ca-ES'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeLanguageTag(input)).toBe(expected);
  });

  it.each([['*'], [''], ['1234'], ['english-US'], [undefined], [42]])('rejects %j', (input) => {
    expect(normalizeLanguageTag(input)).toBeUndefined();
  });
});

describe('languageFromLocale', () => {
  it('builds language-region from the locale codes', () => {
    expect(
      languageFromLocale({ languageTag: 'en-ES-u-fw-mon-mu-celsius', languageCode: 'en', regionCode: 'ES' })
    ).toBe('en-ES');
  });

  it('falls back to the normalized tag when the region code is missing', () => {
    expect(languageFromLocale({ languageTag: 'zh-Hans-CN', languageCode: 'zh', regionCode: null })).toBe('zh-CN');
  });

  it('returns undefined without a locale', () => {
    expect(languageFromLocale(undefined)).toBeUndefined();
  });
});

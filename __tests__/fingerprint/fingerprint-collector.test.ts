import { describe, it, expect, vi } from 'vitest';
import { getLocales } from 'expo-localization';
import { FingerprintCollector } from '../../src/fingerprint/fingerprint-collector';

describe('FingerprintCollector', () => {
  const collector = new FingerprintCollector();

  it('collects a complete fingerprint', () => {
    const fp = collector.collect(168);

    expect(fp.userAgent).toBe('TestApp/1.0.0 ios/17.4');
    expect(fp.timezone).toBe('America/New_York');
    expect(fp.language).toBe('en-US');
    expect(fp.screenWidth).toBe(393);
    expect(fp.screenHeight).toBe(852);
    expect(fp.platform).toBe('ios');
    expect(fp.platformVersion).toBe('17.4');
    expect(fp.appVersion).toBe('1.0.0');
    expect(fp.attributionWindowHours).toBe(168);
    expect(fp.deviceId).toBeUndefined();
  });

  it('includes deviceId when provided', () => {
    const fp = collector.collect(168, 'device-123');
    expect(fp.deviceId).toBe('device-123');
  });

  it('respects custom attribution window', () => {
    const fp = collector.collect(24);
    expect(fp.attributionWindowHours).toBe(24);
  });

  it('sends language-region for a locale with regional preferences', () => {
    vi.mocked(getLocales).mockReturnValueOnce([
      { languageTag: 'en-ES-u-fw-mon-mu-celsius', languageCode: 'en', regionCode: 'ES' },
    ] as ReturnType<typeof getLocales>);
    expect(collector.collect(168).language).toBe('en-ES');
  });

  it('falls back to en-US when no locale is reported', () => {
    vi.mocked(getLocales).mockReturnValueOnce([]);
    expect(collector.collect(168).language).toBe('en-US');
  });
});

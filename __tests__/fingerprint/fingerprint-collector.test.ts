import { describe, it, expect } from 'vitest';
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
});

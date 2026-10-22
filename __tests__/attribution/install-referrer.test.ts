import { describe, it, expect, vi, afterEach } from 'vitest';
import { Platform } from 'react-native';
import { createPlayInstallReferrerReader } from '../../src/attribution/install-referrer';

const REFERRER = 'lf_click=11111111-2222-4333-8444-555555555555&utm_source=poster';

describe('createPlayInstallReferrerReader', () => {
  afterEach(() => {
    (Platform as { OS: string }).OS = 'ios';
    vi.useRealTimers();
  });

  function onAndroid() {
    (Platform as { OS: string }).OS = 'android';
  }

  it('reads nothing on iOS', async () => {
    const read = vi.fn(async () => REFERRER);
    expect(await createPlayInstallReferrerReader(read)()).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('returns the referrer Play recorded', async () => {
    onAndroid();
    expect(await createPlayInstallReferrerReader(async () => REFERRER)()).toBe(REFERRER);
  });

  it('returns null for an empty referrer', async () => {
    onAndroid();
    expect(await createPlayInstallReferrerReader(async () => '  ')()).toBeNull();
  });

  it('asks once more after a failed read', async () => {
    onAndroid();
    const read = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('SERVICE_UNAVAILABLE'))
      .mockResolvedValueOnce(REFERRER);
    expect(await createPlayInstallReferrerReader(read)()).toBe(REFERRER);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('gives up after a second failure', async () => {
    onAndroid();
    const read = vi.fn(async () => {
      throw new Error('FEATURE_NOT_SUPPORTED');
    });
    expect(await createPlayInstallReferrerReader(read)()).toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('returns null when Play does not answer in time', async () => {
    onAndroid();
    vi.useFakeTimers();
    const pending = createPlayInstallReferrerReader(() => new Promise<string>(() => {}), 2000)();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await pending).toBeNull();
  });
});

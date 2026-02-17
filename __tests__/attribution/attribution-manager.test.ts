import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttributionManager } from '../../src/attribution/attribution-manager';
import type { StorageManagerProtocol } from '../../src/storage/storage-manager';
import type { FingerprintCollectorProtocol } from '../../src/fingerprint/fingerprint-collector';
import type { NetworkManagerProtocol } from '../../src/network/network-manager';
import type { InstallAttributionResponse } from '../../src/models/install-response';

function createMockStorage(): StorageManagerProtocol {
  const store: Record<string, string> = {};
  return {
    saveInstallId: vi.fn(async (id) => { store['installId'] = id; }),
    getInstallId: vi.fn(async () => store['installId'] ?? null),
    saveInstallData: vi.fn(async (data) => { store['installData'] = JSON.stringify(data); }),
    getInstallData: vi.fn(async () => store['installData'] ? JSON.parse(store['installData']) : null),
    isFirstLaunch: vi.fn(async () => !store['hasLaunched']),
    setHasLaunched: vi.fn(async () => { store['hasLaunched'] = 'true'; }),
    clearAll: vi.fn(async () => {
      for (const key of Object.keys(store)) delete store[key];
    }),
  };
}

function createMockFingerprint(): FingerprintCollectorProtocol {
  return {
    collect: vi.fn(() => ({
      userAgent: 'TestApp/1.0.0 ios/17.4',
      timezone: 'America/New_York',
      language: 'en-US',
      screenWidth: 393,
      screenHeight: 852,
      platform: 'ios',
      platformVersion: '17.4',
      appVersion: '1.0.0',
      attributionWindowHours: 168,
    })),
  };
}

function createMockNetwork(response: InstallAttributionResponse): NetworkManagerProtocol {
  return {
    request: vi.fn(async () => response),
  };
}

describe('AttributionManager', () => {
  let storage: StorageManagerProtocol;
  let fingerprint: FingerprintCollectorProtocol;

  beforeEach(() => {
    storage = createMockStorage();
    fingerprint = createMockFingerprint();
  });

  it('reports install on first launch and caches data', async () => {
    const serverResponse: InstallAttributionResponse = {
      installId: 'install-uuid-123',
      attributed: true,
      confidenceScore: 85,
      matchedFactors: ['ip', 'user_agent', 'timezone'],
      deepLinkData: {
        shortCode: 'abc123',
        iosUrl: 'myapp://product/1',
        customParameters: { route: 'product' },
      },
    };

    const network = createMockNetwork(serverResponse);
    const manager = new AttributionManager(network, storage, fingerprint);

    const result = await manager.reportInstall(168);

    expect(result.installId).toBe('install-uuid-123');
    expect(result.attributed).toBe(true);
    expect(result.deepLinkData?.shortCode).toBe('abc123');
    expect(network.request).toHaveBeenCalledTimes(1);
    expect(storage.saveInstallId).toHaveBeenCalledWith('install-uuid-123');
    expect(storage.saveInstallData).toHaveBeenCalled();
    expect(storage.setHasLaunched).toHaveBeenCalled();
  });

  it('returns cached data on subsequent launches', async () => {
    const network = createMockNetwork({
      installId: 'x',
      attributed: false,
      confidenceScore: 0,
      matchedFactors: [],
      deepLinkData: null,
    });

    // Simulate prior launch
    await storage.saveInstallId('cached-id');
    await storage.saveInstallData({ shortCode: 'cached' });
    await storage.setHasLaunched();

    const manager = new AttributionManager(network, storage, fingerprint);
    const result = await manager.reportInstall(168);

    expect(network.request).not.toHaveBeenCalled();
    expect(result.installId).toBe('cached-id');
    expect(result.attributed).toBe(true);
    expect(result.deepLinkData?.shortCode).toBe('cached');
  });

  it('treats as organic when network fails', async () => {
    const network: NetworkManagerProtocol = {
      request: vi.fn().mockRejectedValue(new Error('Network down')),
    };

    const manager = new AttributionManager(network, storage, fingerprint);
    const result = await manager.reportInstall(168);

    expect(result.attributed).toBe(false);
    expect(result.deepLinkData).toBeNull();
    expect(storage.setHasLaunched).toHaveBeenCalled();
  });

  it('returns organic response when not attributed', async () => {
    const serverResponse: InstallAttributionResponse = {
      installId: 'organic-id',
      attributed: false,
      confidenceScore: 0,
      matchedFactors: [],
      deepLinkData: null,
    };

    const network = createMockNetwork(serverResponse);
    const manager = new AttributionManager(network, storage, fingerprint);
    const result = await manager.reportInstall(168);

    expect(result.attributed).toBe(false);
    expect(result.deepLinkData).toBeNull();
    expect(storage.saveInstallId).toHaveBeenCalledWith('organic-id');
    expect(storage.saveInstallData).not.toHaveBeenCalled();
  });

  it('normalizes deepLinkParameters to customParameters', async () => {
    const serverResponse: InstallAttributionResponse = {
      installId: 'id-1',
      attributed: true,
      confidenceScore: 90,
      matchedFactors: ['ip'],
      deepLinkData: {
        shortCode: 'xyz',
        deepLinkParameters: { route: 'PRODUCT', id: '42' },
      } as any,
    };

    const network = createMockNetwork(serverResponse);
    const manager = new AttributionManager(network, storage, fingerprint);
    const result = await manager.reportInstall(168);

    expect(result.deepLinkData?.customParameters).toEqual({ route: 'PRODUCT', id: '42' });
  });

  it('getInstallId returns cached value', async () => {
    await storage.saveInstallId('my-id');
    const manager = new AttributionManager(
      createMockNetwork({ installId: '', attributed: false, confidenceScore: 0, matchedFactors: [], deepLinkData: null }),
      storage,
      fingerprint,
    );
    expect(await manager.getInstallId()).toBe('my-id');
  });

  it('clearData clears all storage', async () => {
    await storage.saveInstallId('id');
    await storage.setHasLaunched();
    const manager = new AttributionManager(
      createMockNetwork({ installId: '', attributed: false, confidenceScore: 0, matchedFactors: [], deepLinkData: null }),
      storage,
      fingerprint,
    );
    await manager.clearData();
    expect(storage.clearAll).toHaveBeenCalled();
  });
});

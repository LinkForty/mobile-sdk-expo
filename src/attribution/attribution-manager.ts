import type { FingerprintCollectorProtocol } from '../fingerprint/fingerprint-collector';
import type { NetworkManagerProtocol } from '../network/network-manager';
import type { StorageManagerProtocol } from '../storage/storage-manager';
import type { InstallAttributionResponse } from '../models/install-response';
import type { DeepLinkData } from '../models/deep-link-data';
import { logger } from '../logger';

export class AttributionManager {
  private readonly network: NetworkManagerProtocol;
  private readonly storage: StorageManagerProtocol;
  private readonly fingerprint: FingerprintCollectorProtocol;

  constructor(
    network: NetworkManagerProtocol,
    storage: StorageManagerProtocol,
    fingerprint: FingerprintCollectorProtocol,
  ) {
    this.network = network;
    this.storage = storage;
    this.fingerprint = fingerprint;
  }

  async reportInstall(
    attributionWindowHours: number,
    deviceId?: string,
  ): Promise<InstallAttributionResponse> {
    const isFirst = await this.storage.isFirstLaunch();

    if (!isFirst) {
      return this.buildCachedResponse();
    }

    const fp = this.fingerprint.collect(attributionWindowHours, deviceId);
    logger.log('Reporting install with fingerprint:', fp);

    let response: InstallAttributionResponse;
    try {
      response = await this.network.request<InstallAttributionResponse>(
        '/api/sdk/v1/install',
        {
          method: 'POST',
          body: JSON.stringify(fp),
        },
      );
    } catch (e) {
      logger.error('Failed to report install:', e);
      // Treat as organic on failure
      await this.storage.setHasLaunched();
      return {
        installId: '',
        attributed: false,
        confidenceScore: 0,
        matchedFactors: [],
        deepLinkData: null,
      };
    }

    logger.log('Install response:', response);

    // Cache install ID
    if (response.installId) {
      await this.storage.saveInstallId(response.installId);
    }

    // Cache deep link data if attributed
    if (response.attributed && response.deepLinkData) {
      // Normalize deepLinkParameters -> customParameters
      const deepLinkData: DeepLinkData = {
        ...response.deepLinkData,
        customParameters:
          (response.deepLinkData as DeepLinkData & { deepLinkParameters?: Record<string, string> })
            .deepLinkParameters ?? response.deepLinkData.customParameters,
      };
      await this.storage.saveInstallData(deepLinkData);
      logger.log('Install attributed with confidence:', response.confidenceScore);

      // Return with normalized data
      response = { ...response, deepLinkData };
    } else {
      logger.log('Organic install (no attribution)');
    }

    await this.storage.setHasLaunched();
    return response;
  }

  async getInstallId(): Promise<string | null> {
    return this.storage.getInstallId();
  }

  async getInstallData(): Promise<DeepLinkData | null> {
    return this.storage.getInstallData();
  }

  async isFirstLaunch(): Promise<boolean> {
    return this.storage.isFirstLaunch();
  }

  async clearData(): Promise<void> {
    await this.storage.clearAll();
    logger.log('Attribution data cleared');
  }

  private async buildCachedResponse(): Promise<InstallAttributionResponse> {
    const installId = await this.storage.getInstallId();
    const deepLinkData = await this.storage.getInstallData();

    return {
      installId: installId ?? '',
      attributed: deepLinkData !== null,
      confidenceScore: deepLinkData ? 100 : 0,
      matchedFactors: [],
      deepLinkData,
    };
  }
}

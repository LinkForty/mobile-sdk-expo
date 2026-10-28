import type { FingerprintCollectorProtocol } from '../fingerprint/fingerprint-collector';
import type { NetworkManagerProtocol } from '../network/network-manager';
import type { StorageManagerProtocol } from '../storage/storage-manager';
import type { InstallAttributionResponse } from '../models/install-response';
import type { DeepLinkData } from '../models/deep-link-data';
import { logger } from '../logger';
import { SDK_NAME, SDK_VERSION } from '../version';
import type { InstallReferrerReader } from './install-referrer';

export class AttributionManager {
  private readonly network: NetworkManagerProtocol;
  private readonly storage: StorageManagerProtocol;
  private readonly fingerprint: FingerprintCollectorProtocol;
  private readonly readInstallReferrer?: InstallReferrerReader;

  constructor(
    network: NetworkManagerProtocol,
    storage: StorageManagerProtocol,
    fingerprint: FingerprintCollectorProtocol,
    readInstallReferrer?: InstallReferrerReader,
  ) {
    this.network = network;
    this.storage = storage;
    this.fingerprint = fingerprint;
    this.readInstallReferrer = readInstallReferrer;
  }

  async reportInstall(
    attributionWindowHours: number,
    deviceId?: string,
    appToken?: string,
  ): Promise<InstallAttributionResponse> {
    const isFirst = await this.storage.isFirstLaunch();

    if (!isFirst) {
      return this.buildCachedResponse();
    }

    const fp = this.fingerprint.collect(attributionWindowHours, deviceId);
    // The Play install referrer names the click exactly; without one the
    // install is matched by fingerprint.
    const installReferrer = this.readInstallReferrer ? await this.readInstallReferrer() : null;
    logger.log('Reporting install with fingerprint:', fp, 'install referrer:', installReferrer);

    let response: InstallAttributionResponse;
    try {
      response = await this.network.request<InstallAttributionResponse>(
        '/api/sdk/v1/install',
        {
          method: 'POST',
          // appToken (when provided) scopes the install, organic ones
          // included, to the app's workspace. Omitted when undefined.
          // sdkName/sdkVersion identify the SDK and its version.
          body: JSON.stringify({
            ...fp,
            ...(appToken ? { appToken } : {}),
            ...(installReferrer ? { installReferrer } : {}),
            sdkName: SDK_NAME,
            sdkVersion: SDK_VERSION,
          }),
        },
      );
    } catch (e) {
      logger.error('Failed to report install:', e);
      // Answer as organic for this launch, but leave the install unreported so
      // the next launch reports it again.
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

    // Only the link data is cached, so the response-level attributionMethod
    // and competingLinks stay undefined here; the cached deepLinkData keeps
    // whatever match fields the server sent with it.
    return {
      installId: installId ?? '',
      attributed: deepLinkData !== null,
      confidenceScore: deepLinkData ? 100 : 0,
      matchedFactors: [],
      deepLinkData,
    };
  }
}

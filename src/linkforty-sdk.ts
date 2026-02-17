import type { LinkFortyConfig } from './models/config';
import type { InstallAttributionResponse } from './models/install-response';
import type { DeepLinkData } from './models/deep-link-data';
import type { CreateLinkOptions } from './models/create-link-options';
import type { CreateLinkResult } from './models/create-link-result';
import type { DeferredDeepLinkCallback, DeepLinkCallback } from './deeplink/deep-link-handler';
import { validateConfig } from './models/config';
import { LinkFortyError } from './errors/linkforty-error';
import { NetworkManager } from './network/network-manager';
import { StorageManager } from './storage/storage-manager';
import { FingerprintCollector } from './fingerprint/fingerprint-collector';
import { AttributionManager } from './attribution/attribution-manager';
import { DeepLinkHandler } from './deeplink/deep-link-handler';
import { EventTracker } from './events/event-tracker';
import { EventQueue } from './events/event-queue';
import { logger } from './logger';

export class LinkFortySDK {
  private config: LinkFortyConfig | null = null;
  private networkManager: NetworkManager | null = null;
  private attributionManager: AttributionManager | null = null;
  private deepLinkHandler: DeepLinkHandler | null = null;
  private eventTracker: EventTracker | null = null;
  private _isInitialized = false;

  get isInitialized(): boolean {
    return this._isInitialized;
  }

  // -- Initialization --

  async initialize(config: LinkFortyConfig): Promise<InstallAttributionResponse> {
    if (this._isInitialized) {
      throw LinkFortyError.alreadyInitialized();
    }

    validateConfig(config);
    this.config = config;
    logger.setDebug(config.debug ?? false);

    logger.log('Initializing SDK with config:', {
      baseUrl: config.baseUrl,
      debug: config.debug,
      attributionWindowHours: config.attributionWindowHours,
      apiKey: config.apiKey ? '***' : undefined,
    });

    // Create managers
    const networkManager = new NetworkManager(config.baseUrl, config.apiKey);
    const storageManager = new StorageManager();
    const fingerprintCollector = new FingerprintCollector();
    const eventQueue = new EventQueue();
    await eventQueue.load();

    this.networkManager = networkManager;

    this.attributionManager = new AttributionManager(
      networkManager,
      storageManager,
      fingerprintCollector,
    );

    this.eventTracker = new EventTracker(networkManager, storageManager, eventQueue);

    const deepLinkHandler = new DeepLinkHandler(
      config.baseUrl,
      networkManager,
      fingerprintCollector,
    );
    this.deepLinkHandler = deepLinkHandler;

    this._isInitialized = true;

    // Report install
    const attributionWindowHours = config.attributionWindowHours ?? 168;
    const response = await this.attributionManager.reportInstall(attributionWindowHours);

    // If attributed, deliver deferred deep link
    if (response.attributed && response.deepLinkData) {
      deepLinkHandler.deliverDeferredDeepLink(response.deepLinkData);
    } else {
      deepLinkHandler.deliverDeferredDeepLink(null);
    }

    // Start listening for direct deep links
    deepLinkHandler.startListening();

    logger.log('SDK initialized successfully (attributed:', response.attributed, ')');

    return response;
  }

  // -- Deep Linking --

  onDeferredDeepLink(callback: DeferredDeepLinkCallback): void {
    this.requireDeepLinkHandler().onDeferredDeepLink(callback);
  }

  onDeepLink(callback: DeepLinkCallback): void {
    this.requireDeepLinkHandler().onDeepLink(callback);
  }

  handleDeepLink(url: string): void {
    this.requireDeepLinkHandler().handleDeepLink(url);
  }

  // -- Event Tracking --

  async trackEvent(name: string, properties?: Record<string, unknown>): Promise<void> {
    return this.requireEventTracker().trackEvent(name, properties);
  }

  async trackRevenue(
    amount: number,
    currency: string,
    properties?: Record<string, unknown>,
  ): Promise<void> {
    return this.requireEventTracker().trackRevenue(amount, currency, properties);
  }

  async flushEvents(): Promise<void> {
    return this.requireEventTracker().flushQueue();
  }

  async clearEventQueue(): Promise<void> {
    return this.requireEventTracker().clearQueue();
  }

  get queuedEventCount(): number {
    return this.eventTracker?.queuedEventCount ?? 0;
  }

  // -- Link Creation --

  async createLink(options: CreateLinkOptions): Promise<CreateLinkResult> {
    this.requireInitialized();

    if (!this.config!.apiKey) {
      throw LinkFortyError.missingApiKey();
    }

    const body: Record<string, unknown> = {};
    if (options.templateId) body.templateId = options.templateId;
    if (options.deepLinkParameters) body.deepLinkParameters = options.deepLinkParameters;
    if (options.title) body.title = options.title;
    if (options.description) body.description = options.description;
    if (options.customCode) body.customCode = options.customCode;
    if (options.utmParameters) body.utmParameters = options.utmParameters;

    const useSimplifiedEndpoint = !options.templateId;
    const endpoint = useSimplifiedEndpoint ? '/api/sdk/v1/links' : '/api/links';

    const response = await this.networkManager!.request<{
      id: string;
      short_code: string;
      url?: string;
      shortCode?: string;
      linkId?: string;
    }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    // SDK endpoint returns { url, shortCode, linkId } directly
    if (useSimplifiedEndpoint && response.url) {
      return {
        url: response.url,
        shortCode: response.shortCode || response.short_code,
        linkId: response.linkId || response.id,
      };
    }

    // Dashboard endpoint returns { id, short_code } — build URL from parts
    const shortCode = response.short_code;
    const baseUrl = this.config!.baseUrl.replace(/\/+$/, '');
    const url = options.templateSlug
      ? `${baseUrl}/${options.templateSlug}/${shortCode}`
      : `${baseUrl}/${shortCode}`;

    return {
      url,
      shortCode,
      linkId: response.id,
    };
  }

  // -- Attribution Data --

  async getInstallId(): Promise<string | null> {
    return this.attributionManager?.getInstallId() ?? null;
  }

  async getInstallData(): Promise<DeepLinkData | null> {
    return this.attributionManager?.getInstallData() ?? null;
  }

  async isFirstLaunch(): Promise<boolean> {
    return this.attributionManager?.isFirstLaunch() ?? true;
  }

  // -- Data Management --

  async clearData(): Promise<void> {
    await this.attributionManager?.clearData();
    await this.eventTracker?.clearQueue();
    this.deepLinkHandler?.clearCallbacks();
    logger.log('All SDK data cleared');
  }

  reset(): void {
    this.deepLinkHandler?.cleanup();
    this.config = null;
    this.networkManager = null;
    this.attributionManager = null;
    this.deepLinkHandler = null;
    this.eventTracker = null;
    this._isInitialized = false;
    logger.log('SDK reset to uninitialized state');
  }

  // -- Guards --

  private requireInitialized(): void {
    if (!this._isInitialized) {
      throw LinkFortyError.notInitialized();
    }
  }

  private requireDeepLinkHandler(): DeepLinkHandler {
    if (!this._isInitialized || !this.deepLinkHandler) {
      throw LinkFortyError.notInitialized();
    }
    return this.deepLinkHandler;
  }

  private requireEventTracker(): EventTracker {
    if (!this._isInitialized || !this.eventTracker) {
      throw LinkFortyError.notInitialized();
    }
    return this.eventTracker;
  }
}

export default new LinkFortySDK();

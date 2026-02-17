export { default } from './linkforty-sdk';
export { LinkFortySDK } from './linkforty-sdk';

export { LinkFortyError, LinkFortyErrorCode } from './errors/linkforty-error';

export type { LinkFortyConfig } from './models/config';
export type { DeepLinkData } from './models/deep-link-data';
export type { InstallAttributionResponse } from './models/install-response';
export type { UTMParameters } from './models/utm-parameters';
export type { DeviceFingerprint } from './models/device-fingerprint';
export type { CreateLinkOptions } from './models/create-link-options';
export type { CreateLinkResult } from './models/create-link-result';
export type { EventRequest } from './models/event-request';

export type { DeferredDeepLinkCallback, DeepLinkCallback } from './deeplink/deep-link-handler';

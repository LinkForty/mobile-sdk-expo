import type { UTMParameters } from './utm-parameters';

export interface DeepLinkData {
  shortCode: string;
  iosUrl?: string;
  androidUrl?: string;
  webUrl?: string;
  utmParameters?: UTMParameters;
  customParameters?: Record<string, string>;
  deepLinkPath?: string;
  appScheme?: string;
  clickedAt?: string;
  linkId?: string;
}

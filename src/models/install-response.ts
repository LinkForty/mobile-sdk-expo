import type { DeepLinkData } from './deep-link-data';

export interface InstallAttributionResponse {
  installId: string;
  attributed: boolean;
  confidenceScore: number;
  matchedFactors: string[];
  deepLinkData: DeepLinkData | null;
}

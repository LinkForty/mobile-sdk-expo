import type { UTMParameters } from './utm-parameters';

export interface CreateLinkOptions {
  templateId?: string;
  templateSlug?: string;
  deepLinkParameters?: Record<string, string>;
  title?: string;
  description?: string;
  customCode?: string;
  utmParameters?: UTMParameters;
  /** Identifier for the app user creating the link (enables per-user deduplication and share attribution) */
  externalUserId?: string;
}

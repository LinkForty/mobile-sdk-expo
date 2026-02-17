import type { UTMParameters } from './utm-parameters';

export interface CreateLinkOptions {
  templateId?: string;
  templateSlug?: string;
  deepLinkParameters?: Record<string, string>;
  title?: string;
  description?: string;
  customCode?: string;
  utmParameters?: UTMParameters;
}

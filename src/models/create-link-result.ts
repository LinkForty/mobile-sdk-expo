export interface CreateLinkResult {
  url: string;
  shortCode: string;
  linkId: string;
  /** True if an existing link was returned instead of creating a new one (per-user deduplication) */
  deduplicated?: boolean;
}

/**
 * Last-click attribution models (SIT-237).
 *
 * In-app activity (screen views + custom events) is attributed to the deep link
 * that drove it. Every deep-link open pins an active context; the newest open
 * supersedes the previous one; events are stamped with the active context so the
 * backend can credit the link under a last-click + window model.
 */

/** The deep link currently credited for in-app activity (last-click). */
export interface ActiveAttribution {
  /** The link the deep link resolved to (`DeepLinkData.linkId`) */
  linkId: string;
  /** Optional originating click id (link-level attribution works without it) */
  clickId?: string;
  /** ISO timestamp of when this deep link opened the app */
  openedAt: string;
}

/**
 * Attribution fields merged into every event payload. `sessionId` is always
 * present; the link fields are absent for organic activity (no deep link yet).
 */
export interface AttributionStamp {
  attributedLinkId?: string;
  attributedClickId?: string;
  linkOpenedAt?: string;
  sessionId: string;
}

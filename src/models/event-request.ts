export interface EventRequest {
  installId: string;
  eventName: string;
  eventData: Record<string, unknown>;
  timestamp: string;
  // Last-click attribution stamp (SIT-237) — optional / backward compatible.
  // Captured at event time so queued events keep their point-in-time attribution.
  attributedLinkId?: string;
  attributedClickId?: string;
  linkOpenedAt?: string;
  sessionId?: string;
  // SDK identity for health/version diagnostics (SIT-235)
  sdkName?: string;
  sdkVersion?: string;
}

export interface EventRequest {
  installId: string;
  eventName: string;
  eventData: Record<string, unknown>;
  timestamp: string;
  // Last-click attribution stamp — optional / backward compatible.
  // Captured at event time so queued events keep their point-in-time attribution.
  attributedLinkId?: string;
  attributedClickId?: string;
  linkOpenedAt?: string;
  sessionId?: string;
  // SDK identity: the SDK's name and version.
  sdkName?: string;
  sdkVersion?: string;
  /**
   * The SDK's id for this event, the same on every send of it, so a server
   * that supports it (`@linkforty/core` 1.36.0 or later) stores a resent event
   * once. Servers without it ignore the field.
   */
  clientEventId?: string;
}

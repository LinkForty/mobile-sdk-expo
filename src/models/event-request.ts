export interface EventRequest {
  installId: string;
  eventName: string;
  eventData: Record<string, unknown>;
  timestamp: string;
}

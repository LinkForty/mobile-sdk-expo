export interface DeviceFingerprint {
  userAgent: string;
  timezone: string;
  language: string;
  screenWidth: number;
  screenHeight: number;
  platform: string;
  platformVersion: string;
  appVersion: string;
  deviceId?: string;
  attributionWindowHours: number;
}

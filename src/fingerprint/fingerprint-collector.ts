import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { getLocales, getCalendars } from 'expo-localization';
import { Platform, Dimensions } from 'react-native';
import type { DeviceFingerprint } from '../models/device-fingerprint';

export interface FingerprintCollectorProtocol {
  collect(attributionWindowHours: number, deviceId?: string): DeviceFingerprint;
}

export class FingerprintCollector implements FingerprintCollectorProtocol {
  collect(attributionWindowHours: number, deviceId?: string): DeviceFingerprint {
    const { width, height } = Dimensions.get('window');
    const locales = getLocales();
    const calendars = getCalendars();

    const appName = Application.applicationName ?? 'App';
    const appVersion = Application.nativeApplicationVersion ?? '1.0.0';
    const platform = Platform.OS;
    const platformVersion = Device.osVersion ?? '0';

    return {
      userAgent: `${appName}/${appVersion} ${platform}/${platformVersion}`,
      timezone: calendars[0]?.timeZone ?? 'UTC',
      language: locales[0]?.languageTag ?? 'en-US',
      screenWidth: Math.round(width),
      screenHeight: Math.round(height),
      platform,
      platformVersion,
      appVersion,
      deviceId,
      attributionWindowHours,
    };
  }
}

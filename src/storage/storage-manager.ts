import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DeepLinkData } from '../models/deep-link-data';
import { logger } from '../logger';
import { STORAGE_KEYS } from './storage-keys';

export interface StorageManagerProtocol {
  saveInstallId(installId: string): Promise<void>;
  getInstallId(): Promise<string | null>;
  saveInstallData(data: DeepLinkData): Promise<void>;
  getInstallData(): Promise<DeepLinkData | null>;
  isFirstLaunch(): Promise<boolean>;
  setHasLaunched(): Promise<void>;
  clearAll(): Promise<void>;
}

export class StorageManager implements StorageManagerProtocol {
  async saveInstallId(installId: string): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.INSTALL_ID, installId);
  }

  async getInstallId(): Promise<string | null> {
    return AsyncStorage.getItem(STORAGE_KEYS.INSTALL_ID);
  }

  async saveInstallData(data: DeepLinkData): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INSTALL_DATA, JSON.stringify(data));
    } catch (e) {
      logger.error('Failed to encode install data:', e);
    }
  }

  async getInstallData(): Promise<DeepLinkData | null> {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEYS.INSTALL_DATA);
      if (!json) return null;
      return JSON.parse(json) as DeepLinkData;
    } catch (e) {
      logger.error('Failed to decode install data:', e);
      return null;
    }
  }

  async isFirstLaunch(): Promise<boolean> {
    const flag = await AsyncStorage.getItem(STORAGE_KEYS.FIRST_LAUNCH);
    return flag === null;
  }

  async setHasLaunched(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.FIRST_LAUNCH, 'true');
  }

  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.INSTALL_ID,
      STORAGE_KEYS.INSTALL_DATA,
      STORAGE_KEYS.FIRST_LAUNCH,
      STORAGE_KEYS.EVENT_QUEUE,
    ]);
  }
}

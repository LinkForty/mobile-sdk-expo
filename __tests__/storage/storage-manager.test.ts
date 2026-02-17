import { describe, it, expect, beforeEach } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageManager } from '../../src/storage/storage-manager';
import { STORAGE_KEYS } from '../../src/storage/storage-keys';
import type { DeepLinkData } from '../../src/models/deep-link-data';

describe('StorageManager', () => {
  let storage: StorageManager;

  beforeEach(async () => {
    await AsyncStorage.clear();
    storage = new StorageManager();
  });

  describe('installId', () => {
    it('returns null when no install ID is saved', async () => {
      expect(await storage.getInstallId()).toBeNull();
    });

    it('saves and retrieves install ID', async () => {
      await storage.saveInstallId('test-install-id');
      expect(await storage.getInstallId()).toBe('test-install-id');
    });
  });

  describe('installData', () => {
    const mockData: DeepLinkData = {
      shortCode: 'abc123',
      iosUrl: 'myapp://product/1',
      utmParameters: { source: 'google', campaign: 'test' },
      customParameters: { route: 'product', id: '1' },
    };

    it('returns null when no install data is saved', async () => {
      expect(await storage.getInstallData()).toBeNull();
    });

    it('saves and retrieves install data', async () => {
      await storage.saveInstallData(mockData);
      const result = await storage.getInstallData();
      expect(result).toEqual(mockData);
    });
  });

  describe('firstLaunch', () => {
    it('returns true on first check', async () => {
      expect(await storage.isFirstLaunch()).toBe(true);
    });

    it('returns false after setHasLaunched', async () => {
      await storage.setHasLaunched();
      expect(await storage.isFirstLaunch()).toBe(false);
    });
  });

  describe('installData error handling', () => {
    it('returns null when stored data is corrupted JSON', async () => {
      await AsyncStorage.setItem('@linkforty:install_data', '{not valid json');
      const result = await storage.getInstallData();
      expect(result).toBeNull();
    });
  });

  describe('clearAll', () => {
    it('clears all stored data', async () => {
      await storage.saveInstallId('id-123');
      await storage.saveInstallData({ shortCode: 'abc' });
      await storage.setHasLaunched();
      await AsyncStorage.setItem(STORAGE_KEYS.EVENT_QUEUE, '[]');

      await storage.clearAll();

      expect(await storage.getInstallId()).toBeNull();
      expect(await storage.getInstallData()).toBeNull();
      expect(await storage.isFirstLaunch()).toBe(true);
      expect(await AsyncStorage.getItem(STORAGE_KEYS.EVENT_QUEUE)).toBeNull();
    });
  });
});

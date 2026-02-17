import { vi } from 'vitest';

// Mock expo-device
vi.mock('expo-device', () => ({
  modelName: 'iPhone 15 Pro',
  osVersion: '17.4',
}));

// Mock expo-application
vi.mock('expo-application', () => ({
  applicationName: 'TestApp',
  nativeApplicationVersion: '1.0.0',
  nativeBuildVersion: '1',
}));

// Mock expo-localization
vi.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US' }],
  getCalendars: () => [{ timeZone: 'America/New_York' }],
}));

// Mock expo-linking
vi.mock('expo-linking', () => {
  const listeners: Array<(event: { url: string }) => void> = [];
  return {
    addEventListener: vi.fn((event: string, handler: (event: { url: string }) => void) => {
      if (event === 'url') {
        listeners.push(handler);
      }
      return { remove: vi.fn(() => {
        const idx = listeners.indexOf(handler);
        if (idx >= 0) listeners.splice(idx, 1);
      }) };
    }),
    getInitialURL: vi.fn().mockResolvedValue(null),
    __listeners: listeners,
    __emit: (url: string) => {
      for (const listener of listeners) {
        listener({ url });
      }
    },
  };
});

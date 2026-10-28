import { vi } from 'vitest';

vi.mock('react-native', () => {
  const appStateListeners: Array<(state: string) => void> = [];
  return {
    Platform: {
      OS: 'ios',
      select: vi.fn((obj: Record<string, unknown>) => obj.ios),
    },
    Dimensions: {
      get: vi.fn(() => ({ width: 393, height: 852, scale: 3, fontScale: 1 })),
    },
    AppState: {
      currentState: 'active',
      addEventListener: vi.fn((event: string, handler: (state: string) => void) => {
        if (event === 'change') appStateListeners.push(handler);
        return {
          remove: vi.fn(() => {
            const idx = appStateListeners.indexOf(handler);
            if (idx >= 0) appStateListeners.splice(idx, 1);
          }),
        };
      }),
    },
    __appStateListeners: appStateListeners,
    __emitAppState: (state: string) => {
      for (const listener of [...appStateListeners]) listener(state);
    },
  };
});

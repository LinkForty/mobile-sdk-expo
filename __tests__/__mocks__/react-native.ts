import { vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: vi.fn((obj: Record<string, unknown>) => obj.ios),
  },
  Dimensions: {
    get: vi.fn(() => ({ width: 393, height: 852, scale: 3, fontScale: 1 })),
  },
}));

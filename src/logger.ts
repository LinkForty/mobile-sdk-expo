const TAG = '[LinkForty]';

let debugEnabled = false;

export const logger = {
  setDebug(enabled: boolean): void {
    debugEnabled = enabled;
  },

  log(...args: unknown[]): void {
    if (debugEnabled) {
      console.log(TAG, ...args);
    }
  },

  warn(...args: unknown[]): void {
    console.warn(TAG, ...args);
  },

  error(...args: unknown[]): void {
    console.error(TAG, ...args);
  },
};

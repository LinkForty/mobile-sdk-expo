import { describe, it, expect } from 'vitest';
import { validateConfig } from '../../src/models/config';
import { LinkFortyError, LinkFortyErrorCode } from '../../src/errors/linkforty-error';

describe('validateConfig', () => {
  it('accepts a valid HTTPS config', () => {
    expect(() =>
      validateConfig({ baseUrl: 'https://go.example.com' }),
    ).not.toThrow();
  });

  it('accepts localhost over HTTP', () => {
    expect(() =>
      validateConfig({ baseUrl: 'http://localhost:3000' }),
    ).not.toThrow();
  });

  it('accepts 127.0.0.1 over HTTP', () => {
    expect(() =>
      validateConfig({ baseUrl: 'http://127.0.0.1:3000' }),
    ).not.toThrow();
  });

  it('accepts 0.0.0.0 over HTTP', () => {
    expect(() =>
      validateConfig({ baseUrl: 'http://0.0.0.0:3000' }),
    ).not.toThrow();
  });

  it('accepts 10.0.2.2 over HTTP (Android emulator)', () => {
    expect(() =>
      validateConfig({ baseUrl: 'http://10.0.2.2:3000' }),
    ).not.toThrow();
  });

  it('rejects HTTP for non-localhost', () => {
    expect(() =>
      validateConfig({ baseUrl: 'http://go.example.com' }),
    ).toThrow(LinkFortyError);

    try {
      validateConfig({ baseUrl: 'http://go.example.com' });
    } catch (e) {
      expect((e as LinkFortyError).code).toBe(LinkFortyErrorCode.INVALID_CONFIGURATION);
      expect((e as LinkFortyError).message).toContain('HTTPS');
    }
  });

  it('rejects empty baseUrl', () => {
    expect(() => validateConfig({ baseUrl: '' })).toThrow(LinkFortyError);
  });

  it('rejects invalid URL', () => {
    expect(() => validateConfig({ baseUrl: 'not-a-url' })).toThrow(LinkFortyError);
  });

  it('accepts valid attribution window', () => {
    expect(() =>
      validateConfig({ baseUrl: 'https://go.example.com', attributionWindowHours: 168 }),
    ).not.toThrow();
  });

  it('accepts attribution window at lower bound', () => {
    expect(() =>
      validateConfig({ baseUrl: 'https://go.example.com', attributionWindowHours: 1 }),
    ).not.toThrow();
  });

  it('accepts attribution window at upper bound', () => {
    expect(() =>
      validateConfig({ baseUrl: 'https://go.example.com', attributionWindowHours: 2160 }),
    ).not.toThrow();
  });

  it('rejects attribution window below 1', () => {
    expect(() =>
      validateConfig({ baseUrl: 'https://go.example.com', attributionWindowHours: 0 }),
    ).toThrow(LinkFortyError);
  });

  it('rejects attribution window above 2160', () => {
    expect(() =>
      validateConfig({ baseUrl: 'https://go.example.com', attributionWindowHours: 2161 }),
    ).toThrow(LinkFortyError);
  });

  it('rejects NaN attribution window', () => {
    expect(() =>
      validateConfig({ baseUrl: 'https://go.example.com', attributionWindowHours: NaN }),
    ).toThrow(LinkFortyError);
  });

  it('allows undefined attributionWindowHours (uses default)', () => {
    expect(() =>
      validateConfig({ baseUrl: 'https://go.example.com' }),
    ).not.toThrow();
  });
});

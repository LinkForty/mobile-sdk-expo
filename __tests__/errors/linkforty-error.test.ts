import { describe, it, expect } from 'vitest';
import { LinkFortyError, LinkFortyErrorCode } from '../../src/errors/linkforty-error';

describe('LinkFortyError', () => {
  it('creates a notInitialized error', () => {
    const error = LinkFortyError.notInitialized();
    expect(error).toBeInstanceOf(LinkFortyError);
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe(LinkFortyErrorCode.NOT_INITIALIZED);
    expect(error.message).toContain('not initialized');
    expect(error.name).toBe('LinkFortyError');
  });

  it('creates an alreadyInitialized error', () => {
    const error = LinkFortyError.alreadyInitialized();
    expect(error.code).toBe(LinkFortyErrorCode.ALREADY_INITIALIZED);
    expect(error.message).toContain('already been initialized');
  });

  it('creates an invalidConfiguration error with detail', () => {
    const error = LinkFortyError.invalidConfiguration('baseUrl is required');
    expect(error.code).toBe(LinkFortyErrorCode.INVALID_CONFIGURATION);
    expect(error.message).toContain('baseUrl is required');
  });

  it('creates a networkError with cause', () => {
    const cause = new Error('fetch failed');
    const error = LinkFortyError.networkError(cause);
    expect(error.code).toBe(LinkFortyErrorCode.NETWORK_ERROR);
    expect(error.cause).toBe(cause);
    expect(error.message).toContain('fetch failed');
  });

  it('creates an invalidResponse error with status code', () => {
    const error = LinkFortyError.invalidResponse(500, 'Internal Server Error');
    expect(error.code).toBe(LinkFortyErrorCode.INVALID_RESPONSE);
    expect(error.message).toContain('500');
    expect(error.message).toContain('Internal Server Error');
  });

  it('creates an invalidResponse error without message', () => {
    const error = LinkFortyError.invalidResponse(404);
    expect(error.code).toBe(LinkFortyErrorCode.INVALID_RESPONSE);
    expect(error.message).toContain('404');
  });

  it('creates a decodingError with cause', () => {
    const cause = new SyntaxError('Unexpected token');
    const error = LinkFortyError.decodingError(cause);
    expect(error.code).toBe(LinkFortyErrorCode.DECODING_ERROR);
    expect(error.cause).toBe(cause);
  });

  it('creates an invalidEventData error', () => {
    const error = LinkFortyError.invalidEventData('Event name cannot be empty');
    expect(error.code).toBe(LinkFortyErrorCode.INVALID_EVENT_DATA);
    expect(error.message).toContain('Event name cannot be empty');
  });

  it('creates an invalidDeepLinkUrl error', () => {
    const error = LinkFortyError.invalidDeepLinkUrl('No path segments');
    expect(error.code).toBe(LinkFortyErrorCode.INVALID_DEEP_LINK_URL);
    expect(error.message).toContain('No path segments');
  });

  it('creates a missingApiKey error', () => {
    const error = LinkFortyError.missingApiKey();
    expect(error.code).toBe(LinkFortyErrorCode.MISSING_API_KEY);
    expect(error.message).toContain('API key');
  });
});

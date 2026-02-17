export enum LinkFortyErrorCode {
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  ALREADY_INITIALIZED = 'ALREADY_INITIALIZED',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  DECODING_ERROR = 'DECODING_ERROR',
  INVALID_EVENT_DATA = 'INVALID_EVENT_DATA',
  INVALID_DEEP_LINK_URL = 'INVALID_DEEP_LINK_URL',
  MISSING_API_KEY = 'MISSING_API_KEY',
}

export class LinkFortyError extends Error {
  readonly code: LinkFortyErrorCode;
  readonly cause?: Error;

  constructor(code: LinkFortyErrorCode, message: string, cause?: Error) {
    super(message);
    this.name = 'LinkFortyError';
    this.code = code;
    this.cause = cause;
  }

  static notInitialized(): LinkFortyError {
    return new LinkFortyError(
      LinkFortyErrorCode.NOT_INITIALIZED,
      'LinkForty SDK is not initialized. Call initialize() first.',
    );
  }

  static alreadyInitialized(): LinkFortyError {
    return new LinkFortyError(
      LinkFortyErrorCode.ALREADY_INITIALIZED,
      'LinkForty SDK has already been initialized.',
    );
  }

  static invalidConfiguration(detail: string): LinkFortyError {
    return new LinkFortyError(
      LinkFortyErrorCode.INVALID_CONFIGURATION,
      `Invalid configuration: ${detail}`,
    );
  }

  static networkError(cause: Error): LinkFortyError {
    return new LinkFortyError(
      LinkFortyErrorCode.NETWORK_ERROR,
      `Network error: ${cause.message}`,
      cause,
    );
  }

  static invalidResponse(statusCode: number, message?: string): LinkFortyError {
    const detail = message ? `: ${message}` : '';
    return new LinkFortyError(
      LinkFortyErrorCode.INVALID_RESPONSE,
      `Invalid server response (status: ${statusCode})${detail}`,
    );
  }

  static decodingError(cause: Error): LinkFortyError {
    return new LinkFortyError(
      LinkFortyErrorCode.DECODING_ERROR,
      `Failed to decode response: ${cause.message}`,
      cause,
    );
  }

  static invalidEventData(detail: string): LinkFortyError {
    return new LinkFortyError(
      LinkFortyErrorCode.INVALID_EVENT_DATA,
      `Invalid event data: ${detail}`,
    );
  }

  static invalidDeepLinkUrl(detail: string): LinkFortyError {
    return new LinkFortyError(
      LinkFortyErrorCode.INVALID_DEEP_LINK_URL,
      `Invalid deep link URL: ${detail}`,
    );
  }

  static missingApiKey(): LinkFortyError {
    return new LinkFortyError(
      LinkFortyErrorCode.MISSING_API_KEY,
      'API key is required for this operation. Provide an apiKey in the config.',
    );
  }
}

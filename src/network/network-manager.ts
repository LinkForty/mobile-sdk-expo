import { LinkFortyError } from '../errors/linkforty-error';
import { logger } from '../logger';

export interface NetworkManagerProtocol {
  request<T>(endpoint: string, options?: RequestInit): Promise<T>;
}

export class NetworkManager implements NetworkManagerProtocol {
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly maxRetries = 3;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.performRequest<T>(endpoint, options);
      } catch (e) {
        lastError = e as Error;

        // Don't retry on client errors (4xx) or non-retryable errors
        if (e instanceof LinkFortyError) {
          if (
            e.code === 'INVALID_RESPONSE' &&
            e.message.match(/status: (\d+)/)
          ) {
            const statusMatch = e.message.match(/status: (\d+)/);
            if (statusMatch) {
              const status = parseInt(statusMatch[1], 10);
              if (status >= 400 && status < 500) throw e;
            }
          }
          if (
            e.code === 'INVALID_CONFIGURATION' ||
            e.code === 'DECODING_ERROR'
          ) {
            throw e;
          }
        }

        // Exponential backoff: 1s, 2s, 4s
        if (attempt < this.maxRetries) {
          const delayMs = Math.pow(2, attempt - 1) * 1000;
          logger.log(
            `Request failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delayMs / 1000}s...`,
          );
          await this.delay(delayMs);
        }
      }
    }

    throw lastError instanceof LinkFortyError
      ? lastError
      : LinkFortyError.networkError(
          lastError ?? new Error(`Request failed after ${this.maxRetries} attempts`),
        );
  }

  private async performRequest<T>(endpoint: string, options: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (e) {
      throw LinkFortyError.networkError(e as Error);
    }

    if (!response.ok) {
      let message: string | undefined;
      try {
        const body = await response.json();
        message = body.message || body.error;
      } catch {
        // ignore parse failure
      }
      throw LinkFortyError.invalidResponse(response.status, message);
    }

    try {
      return (await response.json()) as T;
    } catch (e) {
      throw LinkFortyError.decodingError(e as Error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

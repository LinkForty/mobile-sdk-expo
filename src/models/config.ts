import { LinkFortyError } from '../errors/linkforty-error';

export interface LinkFortyConfig {
  /** Base URL of your LinkForty instance (e.g., 'https://go.yourdomain.com') */
  baseUrl: string;
  /** Optional API key for Cloud authentication */
  apiKey?: string;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Attribution window in hours (default: 168 = 7 days) */
  attributionWindowHours?: number;
}

const LOCALHOST_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '10.0.2.2'];

export function validateConfig(config: LinkFortyConfig): void {
  if (!config.baseUrl) {
    throw LinkFortyError.invalidConfiguration('baseUrl is required');
  }

  // Parse URL to validate scheme
  let parsed: URL;
  try {
    parsed = new URL(config.baseUrl);
  } catch {
    throw LinkFortyError.invalidConfiguration(`Invalid base URL: ${config.baseUrl}`);
  }

  // HTTPS required except for localhost
  if (parsed.protocol !== 'https:' && !LOCALHOST_HOSTS.includes(parsed.hostname)) {
    throw LinkFortyError.invalidConfiguration(
      'Base URL must use HTTPS (HTTP only allowed for localhost)',
    );
  }

  // Validate attribution window bounds
  const windowHours = config.attributionWindowHours;
  if (windowHours !== undefined) {
    if (!Number.isFinite(windowHours) || windowHours < 1 || windowHours > 2160) {
      throw LinkFortyError.invalidConfiguration(
        'Attribution window must be between 1 and 2160 hours',
      );
    }
  }
}

import { LinkFortyError } from '../errors/linkforty-error';

export interface LinkFortyConfig {
  /** Base URL of your LinkForty instance (e.g., 'https://go.yourdomain.com') */
  baseUrl: string;
  /** Optional API key for Cloud authentication */
  apiKey?: string;
  /**
   * Public workspace token (LinkForty Cloud only). Recommended — required
   * for organic installs (App Store discovery, social mentions, etc.) to
   * be attributed to your workspace. Find it in the dashboard under
   * Workspace Settings → App Token. Safe to ship in your app bundle.
   * Format: `at_<32 hex chars>`.
   */
  appToken?: string;
  /** Enable debug logging (default: false) */
  debug?: boolean;
  /** Attribution window in hours (default: 168 = 7 days) */
  attributionWindowHours?: number;
  /**
   * Auto-emit `screen_view` events from React Navigation state (no manual
   * per-screen calls). Requires `navigationRef`. Off by default.
   *
   * Pass `true` for the privacy-safe default (screen name only, no params). To
   * capture specific non-PII params, pass an options object with an explicit
   * allow-list: `{ captureParams: ['productId', 'category'] }`. Screen views flow
   * through the normal event pipeline and carry the active deep-link attribution
   * context. Apps without react-navigation are unaffected.
   */
  autoTrackNavigation?: boolean | AutoTrackNavigationOptions;
  /**
   * The app's React Navigation container ref (`createNavigationContainerRef()`),
   * required when `autoTrackNavigation` is enabled. Typed structurally so this
   * SDK never has a compile-time dependency on `@react-navigation/native`.
   */
  navigationRef?: NavigationContainerRefLike;
}

/**
 * Options for `autoTrackNavigation`. No route params are captured by default;
 * opt in per key via `captureParams`.
 */
export interface AutoTrackNavigationOptions {
  /**
   * Explicit allow-list of route param keys whose primitive values may be
   * captured on `screen_view`. Omitted/empty = capture no params. Never list
   * keys that can hold personal data.
   */
  captureParams?: string[];
  /** Debounce window for rapid transitions, in ms. Default 350. */
  debounceMs?: number;
}

/**
 * The slice of a React Navigation route the SDK reads. Structural — matches
 * `getCurrentRoute()` without importing `@react-navigation/native`.
 */
export interface NavigationRouteLike {
  name: string;
  params?: Record<string, unknown>;
}

/** The slice of a React Navigation container ref the SDK uses. Structural. */
export interface NavigationContainerRefLike {
  addListener: (
    type: 'state',
    callback: (event?: unknown) => void,
  ) => (() => void) | { remove?: () => void } | void;
  getCurrentRoute: () => NavigationRouteLike | undefined;
  isReady?: () => boolean;
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

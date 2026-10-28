# LinkForty Expo SDK

Expo SDK for [LinkForty](https://github.com/LinkForty/core) — the open-source alternative to Branch.io, AppsFlyer OneLink, and Firebase Dynamic Links. Add deferred deep linking, mobile attribution, and smart link routing to your Expo app. Self-hosted, privacy-first, no per-click pricing. No config plugin: the SDK is JavaScript on top of Expo modules.

[![npm version](https://img.shields.io/npm/v/@linkforty/mobile-sdk-expo.svg)](https://www.npmjs.com/package/@linkforty/mobile-sdk-expo)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- Deferred deep linking (install attribution: exact from the Google Play install referrer on Android, otherwise by device fingerprinting)
- Direct deep linking with server-side URL resolution
- Event tracking with an offline queue (persists across app restarts)
- Revenue tracking
- Automatic screen tracking with React Navigation (opt-in)
- Programmatic link creation
- No config plugin: built on `expo-device`, `expo-application`, `expo-localization`, `expo-linking` and AsyncStorage

## Requirements

- Expo SDK 51 or later, React Native 0.74 or later, React 18 or later (the package's peer dependencies)
- A [development build](https://docs.expo.dev/develop/development-builds/introduction/) or EAS build to test links: Expo Go can't claim your link domains, so Universal Links and App Links won't open your app there
- Optional: `@react-navigation/native` 6 or later, only for automatic screen tracking

## Installation

```bash
npx expo install @linkforty/mobile-sdk-expo expo-device expo-application expo-localization expo-linking @react-native-async-storage/async-storage
```

List the Expo modules in the command, as above: `npx expo install` then adds the versions that match your app's Expo SDK. The package currently also pins the Expo SDK 52 versions of `expo-device`, `expo-application`, `expo-localization` and `expo-linking` (and `@react-native-async-storage/async-storage` 2.x) as its own dependencies, so on other Expo SDKs npm places those copies inside the package as well, and Expo autolinking reports them as duplicates. Installing only `@linkforty/mobile-sdk-expo` can leave the SDK 52 version as your app's own copy of a module.

No config plugin is needed. After installing, rebuild your development build if it doesn't already include these modules.

## Platform Configuration

Universal Links (iOS) and App Links (Android) need your app to claim your link host. In Expo that is app config (`app.json` or `app.config.*`), not native project files:

```json
{
  "expo": {
    "ios": {
      "associatedDomains": ["applinks:go.yourdomain.com"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [{ "scheme": "https", "host": "go.yourdomain.com" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

Add an entry for every host your links use. Your LinkForty server serves the Apple App Site Association and Digital Asset Links files on those hosts once your app's Apple Team ID / bundle ID and Android package / signing certificate SHA-256 are configured on it. Rebuild after changing this (`npx expo prebuild` if you manage native projects, or a new development / EAS build).

### Expo Router: stop short links hitting "Unmatched Route"

Expo Router routes an incoming URL's path itself, so a short link like `https://go.yourdomain.com/abc123` becomes the route `/abc123` and shows "Unmatched Route". Add an [`app/+native-intent.tsx`](https://docs.expo.dev/router/advanced/native-intent/) that leaves your link hosts to the SDK: your `onDeepLink` callback receives the link once it is resolved and navigates:

```typescript
// app/+native-intent.tsx
const LINK_HOSTS = ['go.yourdomain.com']; // the hosts in app.json

export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    const { hostname } = new URL(path);
    if (LINK_HOSTS.includes(hostname)) {
      // The SDK delivers this link to onDeepLink. On launch, start at the home
      // screen; while running, stay where the user is.
      return initial ? '/' : null;
    }
  } catch {
    // Not an absolute URL (a scheme link or plain path): let Expo Router handle it.
  }
  return path;
}
```

Keep this function free of anything that can throw: Expo Router calls it before your app's components run.

## Quick Start

```typescript
import LinkForty from '@linkforty/mobile-sdk-expo';

// Call once at app startup. A second call throws ALREADY_INITIALIZED,
// so guard code that fast refresh can re-run.
export async function setUpLinkForty() {
  if (LinkForty.isInitialized) return;

  const response = await LinkForty.initialize({
    baseUrl: 'https://api.linkforty.com', // the hosted service, or your own server's URL
    appToken: 'at_a1b2c3d4...',  // Required on the hosted service: scopes installs and link lookups to your workspace
    apiKey: 'your-api-key',      // Optional, only needed for createLink()
    debug: true,                 // Optional, enables verbose logging
    attributionWindowHours: 168, // Optional, default 7 days
  });

  // Check attribution
  if (response.attributed) {
    console.log('Install attributed!', response.deepLinkData);
  }

  // Listen for deferred deep links (new installs)
  LinkForty.onDeferredDeepLink((data) => {
    if (data) {
      console.log('Deferred deep link:', data.shortCode);
      // Navigate to content
    }
  });

  // Listen for direct deep links (existing users)
  LinkForty.onDeepLink((url, data) => {
    console.log('Deep link received:', url);
    if (data?.customParameters?.route) {
      // Navigate to route
    }
  });
}
```

Register both callbacks right after `initialize()` resolves: they can only be registered once the SDK is initialized, and a link that arrives while no `onDeepLink` callback is registered is not delivered later. The deferred deep link is kept, so `onDeferredDeepLink` registered after `initialize()` still receives it.

## API Reference

### Initialization

```typescript
await LinkForty.initialize(config);    // Returns InstallAttributionResponse
LinkForty.isInitialized;               // boolean getter
```

`initialize()` returns an `InstallAttributionResponse` on every launch. On the launch that reports the install it carries the server's answer; on later launches it is rebuilt from what was saved (`attributed` is true when install link data is saved, `confidenceScore` is 100 or 0, `matchedFactors` is empty). If the install report fails, it resolves as organic (`attributed: false`, empty `installId`) rather than rejecting, and the install is not reported again.

### Deep Linking

```typescript
LinkForty.onDeferredDeepLink(callback); // Deferred (install attribution)
LinkForty.onDeepLink(callback);         // Direct (multiple callbacks supported)
LinkForty.handleDeepLink(url);          // Manual URL pass-through
```

A LinkForty link is resolved on the server for its `customParameters`, UTM parameters and metadata, falling back to a local parse if that fails; any other URL reaches `onDeepLink` with `data` set to `null`. A LinkForty link is an `http(s)` URL on your `baseUrl` host or, with `appToken` set, on one of your workspace's link hosts: its `toapp.me` label and verified custom domains. The SDK learns those hosts from the server at launch (`GET /api/sdk/v1/link-domains`) and saves them for the next one; on a server without that endpoint, such as `@linkforty/core` today, only the `baseUrl` host counts. With `appToken` set, a lookup answers only with your own workspace's links.

`onDeferredDeepLink` is called once, on the launch that reports the install: with the link's data, or `null` for an organic install. Later launches don't call it; `getInstallData()` returns the install's link data at any time.

On a matched install, the deferred deep link also carries the match's certainty when the server sends it: `confidenceScore` (0-100), `matchedFactors`, `attributionMethod` (`'install_referrer'` or `'fingerprint'`) and `competingLinks`. `competingLinks` counts the other links that had a click from the install's network that also reached the confidence threshold. Above 0, another device's tap may be what led to this install, so an app acting on a sensitive link (sign-in, gift) can treat the match as unverified, for example by asking the user to confirm. The `InstallAttributionResponse` returned by `initialize()` carries `attributionMethod` (`'install_referrer'`, `'fingerprint'` or `'none'`) and `competingLinks` too, on the launch that reports the install. Direct opens never carry these fields, and older servers omit them.

On Android, the SDK reads the Google Play install referrer (through `expo-application`) on the launch that reports the install, waiting at most 2 seconds, and sends it with the install. A LinkForty link puts its click id in the referrer of the Play listing it sends a visitor to, so a server on `@linkforty/core` 1.41.1 or later matches the install to that exact click: `attributionMethod` is `'install_referrer'`, `confidenceScore` 100 and `competingLinks` 0. Without a referrer (another store, a sideload, no answer from Play) the install is matched by fingerprint. iOS has no install referrer.

### Event Tracking

```typescript
await LinkForty.trackEvent(name, properties?);
await LinkForty.trackRevenue(amount, currency, properties?);
await LinkForty.flushEvents();          // Flush offline queue
await LinkForty.clearEventQueue();      // Clear without sending
LinkForty.queuedEventCount;            // Queue size getter
```

`trackEvent()` and `trackRevenue()` reject when the send fails (after the event has been queued; see [Offline Resilience](#offline-resilience)), so catch the error where you call them. Both need the install ID from the install report: if that report failed on the app's first launch, they reject with `NOT_INITIALIZED` and the event is not queued.

Every tracked event (including auto screen views) is automatically attributed to the deep link that drove the visit using a last-click model — so re-engagement campaigns are credited to the link the user tapped, not their original install link.

### Automatic Screen Tracking

Auto-emit a `screen_view` event on each navigation — no manual per-screen calls — so your dashboard can show an **attributed screen-flow funnel** per campaign. Opt-in, via [React Navigation](https://reactnavigation.org/) (an **optional** peer dependency):

```typescript
import LinkForty, { type NavigationContainerRefLike } from '@linkforty/mobile-sdk-expo';
import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

await LinkForty.initialize({
  baseUrl: 'https://api.linkforty.com',
  appToken: 'at_a1b2c3d4...',
  autoTrackNavigation: true, // screen names only (privacy-safe default)
  // Also pass this to <NavigationContainer ref={navigationRef}>. The cast is needed
  // under strict TypeScript: React Navigation types route params as `object`.
  navigationRef: navigationRef as NavigationContainerRefLike,
});
```

With Expo Router, there is no `NavigationContainer` to pass a ref to: use `useNavigationContainerRef()` from `expo-router` in your root layout and pass that ref (with the same cast).

**Route params are OFF by default** (they can contain PII). To capture specific non-PII params, opt in with an explicit allow-list:

```typescript
autoTrackNavigation: { captureParams: ['productId', 'category'] }
```

Apps that don't use React Navigation simply omit `navigationRef` — nothing changes and there's no required dependency. Rapid transitions are debounced (350 ms by default, `debounceMs` to change it) and same-screen re-renders deduped. Each `screen_view` carries `screen`, `previousScreen` (after the first) and `params` (allow-listed keys only).

### Link Creation

Requires `apiKey` in config.

```typescript
const result = await LinkForty.createLink({
  deepLinkParameters: { route: 'PRODUCT', id: '123' },
  title: 'Check out this product',
  utmParameters: { source: 'app', medium: 'share' },
});
console.log(result.url); // https://go.yourdomain.com/tmpl/abc123
```

Options: `templateId`, `templateSlug`, `deepLinkParameters`, `title`, `description`, `customCode`, `utmParameters`, `externalUserId`, `webFallbackUrl`. Without `templateId` the SDK calls `POST /api/sdk/v1/links`, which the hosted service serves and returns the link's full URL; with `templateId` it calls `POST /api/links` and builds the URL from `baseUrl`, `templateSlug` and the short code. A self-hosted `@linkforty/core` server doesn't support `createLink()`: it has no `/api/sdk/v1/links`, and its `POST /api/links` requires an `originalUrl` the SDK doesn't send.

### User Identity

```typescript
LinkForty.setExternalUserId('user-123'); // Attached to every createLink() unless overridden per call; null clears it
LinkForty.getExternalUserId();           // string | null
LinkForty.getSessionId();                // Current session id; rotates on cold start and each deep-link open
```

### Attribution Data

```typescript
await LinkForty.getInstallId();    // Cached install UUID
await LinkForty.getInstallData();  // Cached DeepLinkData
await LinkForty.isFirstLaunch();   // First launch status
```

### Data Management

```typescript
await LinkForty.clearData();  // Wipe all stored SDK data
LinkForty.reset();             // Return to uninitialized state
```

### Named Exports

```typescript
import { LinkFortySDK, LinkFortyError, LinkFortyErrorCode } from '@linkforty/mobile-sdk-expo';
import type {
  LinkFortyConfig,
  NavigationContainerRefLike,
  DeepLinkData,
  AttributionMethod,
  InstallAttributionResponse,
  UTMParameters,
  DeviceFingerprint,
  CreateLinkOptions,
  CreateLinkResult,
  EventRequest,
  AutoTrackNavigationOptions,
  DeferredDeepLinkCallback,
  DeepLinkCallback,
} from '@linkforty/mobile-sdk-expo';
```

## Error Handling

The SDK is the package's default export (`import LinkForty from '@linkforty/mobile-sdk-expo'`); there is no named `LinkForty` export.

All SDK errors are instances of `LinkFortyError` with a `.code` property (and `.statusCode` for `INVALID_RESPONSE`):

| Code                    | When                                                           |
|-------------------------|----------------------------------------------------------------|
| `NOT_INITIALIZED`       | Method called before `initialize()`                            |
| `ALREADY_INITIALIZED`   | `initialize()` called twice                                    |
| `INVALID_CONFIGURATION` | Bad config (missing or invalid `baseUrl`, HTTP on a host other than `localhost`, `127.0.0.1`, `0.0.0.0` or `10.0.2.2`, attribution window outside 1–2160 hours) |
| `NETWORK_ERROR`         | Network request failed after 3 attempts                        |
| `INVALID_RESPONSE`      | Server returned non-2xx response (4xx is not retried; 5xx is retried up to 3 attempts) |
| `DECODING_ERROR`        | Failed to parse server response                                |
| `INVALID_EVENT_DATA`    | Empty event name or negative revenue                           |
| `MISSING_API_KEY`       | `createLink()` called without API key                          |
| `INVALID_DEEP_LINK_URL` | Defined for compatibility; not currently thrown                |

## Offline Resilience

An event that fails to send (offline, or any error after retries) is queued in AsyncStorage and survives app restarts. The queue holds 100 events; when it is full, new failed events are dropped. Queued events are sent after the next event that sends successfully, or when you call `flushEvents()`; the SDK doesn't send them on launch or when connectivity returns. Events carry no unique ID, so an event whose send reached the server but whose response was lost is sent again and can be counted twice.

## Configuration

| Field                    | Type      | Required   | Default   | Description                       |
|--------------------------|-----------|------------|-----------|-----------------------------------|
| `baseUrl`                | `string`  | Yes        | -         | LinkForty server URL: `https://api.linkforty.com` on the hosted service, or your own server. HTTPS required except on `localhost`, `127.0.0.1`, `0.0.0.0` and `10.0.2.2` |
| `appToken`               | `string`  | Hosted: yes | -        | Public workspace token (`at_…`), safe to ship in the app. Sent on every request: scopes install matching and link lookups to your workspace, attributes organic installs, and lets the SDK learn your workspace's link hosts |
| `apiKey`                 | `string`  | No         | -         | API key, only needed for `createLink()` |
| `debug`                  | `boolean` | No         | `false`   | Enable verbose logging            |
| `attributionWindowHours` | `number`  | No         | `168`     | Attribution window (1–2160 hours) |
| `autoTrackNavigation`    | `boolean \| { captureParams?: string[]; debounceMs?: number }` | No | `false` | Auto-emit `screen_view` from React Navigation (screen names only unless params are allow-listed) |
| `navigationRef`          | `NavigationContainerRefLike` | No | - | React Navigation ref; required when `autoTrackNavigation` is enabled |

## Privacy

The SDK doesn't collect IDFA or GAID and never shows the App Tracking Transparency prompt. To match installs it sends: time zone, language, screen width and height, platform and OS version, app version, and a user agent built from your app's name and version; on Android, the Google Play install referrer. The server also sees the request's IP address. Link lookups send the time zone, language, screen size, platform and OS version. Events send the install ID, the event name and properties you pass, a timestamp, the session ID and the attributed link. Every request names the SDK and its version. Keep personal data out of event properties and captured route params.

## Other SDKs

| Platform | Package |
|----------|---------|
| React Native | [`@linkforty/mobile-sdk-react-native`](https://github.com/LinkForty/mobile-sdk-react-native) |
| iOS (Swift) | [LinkFortySDK](https://github.com/LinkForty/mobile-sdk-ios) |
| Android (Kotlin) | [LinkFortySDK](https://github.com/LinkForty/mobile-sdk-android) |
| Flutter | [`linkforty`](https://github.com/LinkForty/mobile-sdk-flutter) |

## Contributing

Contributions are welcome! Please open an issue or pull request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- **Documentation:** [docs.linkforty.com](https://docs.linkforty.com)
- **Issues:** [GitHub Issues](https://github.com/LinkForty/mobile-sdk-expo/issues)
- **Core Engine:** [LinkForty Core](https://github.com/LinkForty/core) — self-hosted open-source backend
- **Hosted service:** [linkforty.com](https://linkforty.com)

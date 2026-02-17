# LinkForty Expo SDK

Expo SDK for [LinkForty](https://linkforty.com) - deep linking and mobile attribution for Expo apps.

## Features

- Deferred deep linking (install attribution via device fingerprinting)
- Direct deep linking with server-side URL resolution
- Event tracking with offline queue (persists across app restarts)
- Revenue tracking
- Programmatic link creation
- Pure Expo modules - no native linking required (`expo-device`, `expo-application`, `expo-localization`, `expo-linking`)

## Installation

```bash
npx expo install @linkforty/mobile-sdk-expo expo-device expo-application expo-localization expo-linking @react-native-async-storage/async-storage
```

## Quick Start

```typescript
import LinkForty from '@linkforty/mobile-sdk-expo';

// Initialize (call once at app startup)
const response = await LinkForty.initialize({
  baseUrl: 'https://go.yourdomain.com',
  apiKey: 'your-api-key',       // Optional, required for link creation
  debug: true,                   // Optional, enables verbose logging
  attributionWindowHours: 168,   // Optional, default 7 days
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
```

## API Reference

### Initialization

```typescript
await LinkForty.initialize(config);    // Returns InstallAttributionResponse
LinkForty.isInitialized;               // boolean getter
```

### Deep Linking

```typescript
LinkForty.onDeferredDeepLink(callback); // Deferred (install attribution)
LinkForty.onDeepLink(callback);         // Direct (multiple callbacks supported)
LinkForty.handleDeepLink(url);          // Manual URL pass-through
```

### Event Tracking

```typescript
await LinkForty.trackEvent(name, properties?);
await LinkForty.trackRevenue(amount, currency, properties?);
await LinkForty.flushEvents();          // Flush offline queue
await LinkForty.clearEventQueue();      // Clear without sending
LinkForty.queuedEventCount;            // Queue size getter
```

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
  DeepLinkData,
  InstallAttributionResponse,
  UTMParameters,
  DeviceFingerprint,
  CreateLinkOptions,
  CreateLinkResult,
  EventRequest,
  DeferredDeepLinkCallback,
  DeepLinkCallback,
} from '@linkforty/mobile-sdk-expo';
```

## Error Handling

All SDK errors are instances of `LinkFortyError` with a `.code` property:

| Code                    | When                                                           |
|-------------------------|----------------------------------------------------------------|
| `NOT_INITIALIZED`       | Method called before `initialize()`                            |
| `ALREADY_INITIALIZED`   | `initialize()` called twice                                    |
| `INVALID_CONFIGURATION` | Bad config (HTTP on non-localhost, invalid attribution window) |
| `NETWORK_ERROR`         | Network request failed after retries                           |
| `INVALID_RESPONSE`      | Server returned non-2xx response                               |
| `DECODING_ERROR`        | Failed to parse server response                                |
| `INVALID_EVENT_DATA`    | Empty event name or negative revenue                           |
| `MISSING_API_KEY`       | `createLink()` called without API key                          |

## Offline Resilience

Events that fail to send are automatically queued in AsyncStorage (max 100 events, persists across app restarts). Successfully tracked events trigger a queue flush attempt. You can also manually flush or clear the queue.

## Configuration

| Field                    | Type      | Required   | Default   | Description                       |
|--------------------------|-----------|------------|-----------|-----------------------------------|
| `baseUrl`                | `string`  | Yes        | -         | LinkForty server URL              |
| `apiKey`                 | `string`  | No         | -         | API key for link creation         |
| `debug`                  | `boolean` | No         | `false`   | Enable verbose logging            |
| `attributionWindowHours` | `number`  | No         | `168`     | Attribution window (1–2160 hours) |

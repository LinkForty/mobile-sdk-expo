# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-02-27
### Fixed
- Corrected GitHub repository, bugs, and homepage URLs in package.json

## [1.0.1] - 2026-02-26
### Added
- `llms.txt` — LLM-optimized integration reference shipped with the published package, enabling AI coding assistants to generate accurate integration code directly from node_modules

## [1.0.0] - 2026-02-16

### Added
- Initial release of the LinkForty Expo SDK
- Initialization with config validation (HTTPS enforcement, attribution window bounds)
- Deferred deep linking (install attribution via device fingerprinting)
- Direct deep linking with multiple callback support
- Server-side URL resolution with fingerprint query parameters
- Event tracking with install ID correlation
- Revenue tracking (`trackRevenue`)
- Programmatic link creation (simplified + dashboard endpoints)
- Attribution data access (`getInstallId`, `getInstallData`, `isFirstLaunch`)
- Persistent offline event queue (AsyncStorage-backed, max 100 events, FIFO)
- Manual queue management (`flushEvents`, `clearEventQueue`, `queuedEventCount`)
- Data management (`clearData`, `reset`)
- Typed error handling (`LinkFortyError` with `LinkFortyErrorCode` enum)
- Network retry with exponential backoff (3 attempts, 1s/2s/4s, no retry on 4xx)
- Debug logging via `debug` config flag
- Pure Expo module dependencies (no native linking required)
- Comprehensive Vitest test suite (119 tests)

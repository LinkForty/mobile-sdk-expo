## 1.4.0 (2026-05-04)

* feat: add appToken config option for Cloud organic-install attribution (#1) ([8261ca4](https://github.com/LinkForty/mobile-sdk-expo/commit/8261ca4)), closes [#1](https://github.com/LinkForty/mobile-sdk-expo/issues/1) [LinkForty/cloud#76](https://github.com/LinkForty/cloud/issues/76)
* ci: drop flaky 'npm install -g npm@latest' self-upgrade step (#2) ([f1cebdd](https://github.com/LinkForty/mobile-sdk-expo/commit/f1cebdd)), closes [#2](https://github.com/LinkForty/mobile-sdk-expo/issues/2) [#1](https://github.com/LinkForty/mobile-sdk-expo/issues/1)
* update packages ([334885e](https://github.com/LinkForty/mobile-sdk-expo/commit/334885e))

## 1.3.0 (2026-04-01)

* feat: add webFallbackUrl to CreateLinkOptions ([d96c7ae](https://github.com/LinkForty/mobile-sdk-expo/commit/d96c7ae))

## 1.2.0 (2026-03-17)

* ci: add semantic-release with OIDC trusted publishing to npm ([05c7918](https://github.com/LinkForty/mobile-sdk-expo/commit/05c7918))
* feat: add setExternalUserId for SDK-level user attribution ([f555707](https://github.com/LinkForty/mobile-sdk-expo/commit/f555707))
* chore: add .claude/ to gitignore ([4c6aade](https://github.com/LinkForty/mobile-sdk-expo/commit/4c6aade))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-03-03
### Added
- `externalUserId` option in `CreateLinkOptions` — identifies the app user creating the link, enabling per-user deduplication and share attribution
- `deduplicated` boolean in `CreateLinkResult` — indicates when an existing link was returned instead of creating a new one (per-user deduplication)

## [1.0.3] - 2026-02-27
### Changed
- Optimized README and npm package description for LLM discoverability
- Added competitor positioning keywords and cross-SDK references
- Added `firebase-dynamic-links` npm keyword

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

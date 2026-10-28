## <small>1.9.1 (2026-10-28)</small>

* docs: correct README against the published 1.9.0 API (#12) ([2a49b89](https://github.com/LinkForty/mobile-sdk-expo/commit/2a49b89)), closes [#12](https://github.com/LinkForty/mobile-sdk-expo/issues/12)

## 1.9.0 (2026-10-22)

* feat(attribution): send the Google Play install referrer with the install (#11) ([4e7980b](https://github.com/LinkForty/mobile-sdk-expo/commit/4e7980b)), closes [#11](https://github.com/LinkForty/mobile-sdk-expo/issues/11)

## 1.8.0 (2026-10-21)

* feat(attribution): expose install-match certainty fields (#10) ([cd7d1b9](https://github.com/LinkForty/mobile-sdk-expo/commit/cd7d1b9)), closes [#10](https://github.com/LinkForty/mobile-sdk-expo/issues/10)

## <small>1.7.1 (2026-10-21)</small>

* fix(deeplink): deliver the deferred deep link once, on the launch that reports the install (#9) ([ed4d0e1](https://github.com/LinkForty/mobile-sdk-expo/commit/ed4d0e1)), closes [#9](https://github.com/LinkForty/mobile-sdk-expo/issues/9)

## 1.7.0 (2026-10-21)

* feat(deeplink): look up links on the workspace's link hosts, and name the app on every request (#8) ([38e9101](https://github.com/LinkForty/mobile-sdk-expo/commit/38e9101)), closes [#8](https://github.com/LinkForty/mobile-sdk-expo/issues/8)

## <small>1.6.2 (2026-10-19)</small>

* fix(fingerprint): send the device language as language-region (#7) ([5f8181a](https://github.com/LinkForty/mobile-sdk-expo/commit/5f8181a)), closes [#7](https://github.com/LinkForty/mobile-sdk-expo/issues/7)

## <small>1.6.1 (2026-09-10)</small>

* fix(deeplink): keep URL parameters on a direct open (#6) ([39ddc1d](https://github.com/LinkForty/mobile-sdk-expo/commit/39ddc1d)), closes [#6](https://github.com/LinkForty/mobile-sdk-expo/issues/6)

## 1.6.0 (2026-06-10)

* feat(sdk): report SDK name + version (SIT-235 · Expo) (#5) ([554b45d](https://github.com/LinkForty/mobile-sdk-expo/commit/554b45d)), closes [#5](https://github.com/LinkForty/mobile-sdk-expo/issues/5)

## 1.5.0 (2026-06-10)

* feat: port last-click attribution + autoTrackNavigation to the Expo SDK (SIT-237) (#4) ([418c160](https://github.com/LinkForty/mobile-sdk-expo/commit/418c160)), closes [#4](https://github.com/LinkForty/mobile-sdk-expo/issues/4)

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

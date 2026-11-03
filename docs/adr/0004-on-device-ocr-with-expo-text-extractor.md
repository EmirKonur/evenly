# 0004: On-device OCR with expo-text-extractor

## Context

Receipt scanning needs text recognition that runs on the device (receipts are personal, and the app has no server), works with the current Expo SDK and the New Architecture, and degrades cleanly where it cannot run: Expo Go and the web build.

## Decision

Use `expo-text-extractor` 2.0. It is an Expo Modules API module (so it works with the New Architecture without a bridge shim) that wraps Apple's Vision framework on iOS and Google ML Kit on Android, returning recognized lines (iOS) or blocks (Android, split on newlines by the adapter). The app checks for the native module with `requireOptionalNativeModule('ExpoTextExtractor')` and only imports the package lazily when it exists, so Expo Go never evaluates a module whose native half is missing. A `.web.ts` adapter reports OCR as unavailable. The parser is pure TypeScript and also accepts pasted text, which is the fallback path everywhere.

## Alternatives considered

- **@infinitered/react-native-mlkit-text-recognition.** The most established option and it returns bounding boxes, but on iOS it uses ML Kit pods that are not arm64-simulator friendly (its issue tracker documents Rosetta being required on Apple Silicon simulators), and its SDK 58 upgrade was still an open pull request when this was written.
- **expo-mlkit-ocr.** Returns bounding boxes and can use Vision on iOS, but it is younger, has a single maintainer, and requires raising the iOS deployment target with expo-build-properties.
- **react-native-vision-camera with a frame-processor OCR plugin.** Built for live camera frames; a receipt is a single still photo, so it is more machinery than the job needs.
- **Cloud OCR.** Better accuracy on crumpled paper, but it breaks the offline promise and sends receipts to a third party.

## Consequences

Recognition needs a development or store build; this is documented in the README and shown on the scan screen. expo-text-extractor returns text without positions, so the parser reconstructs rows from order alone (column reflow, next-line prices), and the review screen's arithmetic check is the safety net. If a maintained module that exposes line frames appears, row reconstruction can become geometric; the adapter in `src/features/receipt/ocr.ts` is the only file that would change.

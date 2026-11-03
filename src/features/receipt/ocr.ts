import { requireOptionalNativeModule } from 'expo';

/**
 * On-device text recognition through expo-text-extractor (Apple Vision on iOS, Google ML
 * Kit on Android). The native module only exists in a development or production build;
 * Expo Go and the web build do not have it, so availability is checked up front and the
 * scan screen offers paste and manual entry instead. Nothing is ever sent off the device.
 */
const nativeModule = requireOptionalNativeModule('ExpoTextExtractor');

export const ocrAvailable: boolean = nativeModule !== null;

export const ocrUnavailableReason =
  'Reading receipts from photos needs the installed Evenly app (a development or store build). Expo Go does not include the text recognition module.';

export async function recognizeText(imageUri: string): Promise<string[]> {
  if (!nativeModule) throw new Error(ocrUnavailableReason);
  // Imported lazily so Expo Go never evaluates a module whose native half is missing.
  const { extractTextFromImage } = await import('expo-text-extractor');
  const blocks = await extractTextFromImage(imageUri);
  // Android returns text blocks with embedded newlines; iOS returns one entry per line.
  return blocks.flatMap((block) => block.split('\n'));
}

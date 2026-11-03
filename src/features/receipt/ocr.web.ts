/** Browsers have no on-device OCR here; the scan screen falls back to paste and manual entry. */
export const ocrAvailable = false;

export const ocrUnavailableReason =
  'The web version cannot read photos. Paste the receipt text or type the items in; the phone app reads photos on the device.';

export async function recognizeText(_imageUri: string): Promise<string[]> {
  throw new Error(ocrUnavailableReason);
}

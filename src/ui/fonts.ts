import { fonts } from './theme';

/** Self-hosted, subset TTFs (Latin, Latin-1, Latin Extended-A, currency symbols). */
export const fontAssets = {
  [fonts.displayMedium]: require('../../assets/fonts/Fredoka-Medium.ttf'),
  [fonts.display]: require('../../assets/fonts/Fredoka-SemiBold.ttf'),
  [fonts.displayBold]: require('../../assets/fonts/Fredoka-Bold.ttf'),
  [fonts.body]: require('../../assets/fonts/Nunito-Regular.ttf'),
  [fonts.bodySemi]: require('../../assets/fonts/Nunito-SemiBold.ttf'),
  [fonts.bodyBold]: require('../../assets/fonts/Nunito-Bold.ttf'),
  [fonts.bodyHeavy]: require('../../assets/fonts/Nunito-ExtraBold.ttf'),
};

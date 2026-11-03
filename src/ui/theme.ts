import { useColorScheme, type TextStyle } from 'react-native';

/**
 * Design tokens. Light mode is cream paper with plum ink; dark mode is the same plum turned
 * into the background with cream ink. Tangerine is the action color in both, and it always
 * carries plum text (white on tangerine fails WCAG AA). Mint means "you're owed", berry
 * means "you owe".
 */
const palette = {
  cream: '#FFF4E6',
  paper: '#FFFBF5',
  sand: '#FBE8D2',
  sandLine: '#EBD3B8',
  plum: '#2D1537',
  plumSoft: '#654A6B',
  plumFaint: '#8C7489',
  night: '#1C1021',
  nightRaised: '#28172E',
  nightSunken: '#341F3B',
  nightLine: '#4A3350',
  creamSoft: '#D6C2D2',
  creamFaint: '#A08B9D',
  tangerine: '#FF6A3D',
  tangerineDeep: '#D9502A',
  tangerineNight: '#FF7B52',
  mintInk: '#0B7656',
  mintFill: '#C4F1DE',
  mintNight: '#62E3B6',
  mintNightFill: '#1D4538',
  berryInk: '#B8324A',
  berryFill: '#FFDCD7',
  berryNight: '#FF8C9C',
  berryNightFill: '#4D2131',
  sunflower: '#FFC93C',
} as const;

export interface Colors {
  background: string;
  surface: string;
  sunken: string;
  line: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  primary: string;
  primaryEdge: string;
  onPrimary: string;
  owed: string;
  owedFill: string;
  owe: string;
  oweFill: string;
  highlight: string;
  focus: string;
  scrim: string;
}

const light: Colors = {
  background: palette.cream,
  surface: palette.paper,
  sunken: palette.sand,
  line: palette.sandLine,
  ink: palette.plum,
  inkSoft: palette.plumSoft,
  inkFaint: palette.plumFaint,
  primary: palette.tangerine,
  primaryEdge: palette.tangerineDeep,
  onPrimary: palette.plum,
  owed: palette.mintInk,
  owedFill: palette.mintFill,
  owe: palette.berryInk,
  oweFill: palette.berryFill,
  highlight: palette.sunflower,
  focus: palette.plum,
  scrim: 'rgba(45, 21, 55, 0.45)',
};

const dark: Colors = {
  background: palette.night,
  surface: palette.nightRaised,
  sunken: palette.nightSunken,
  line: palette.nightLine,
  ink: palette.cream,
  inkSoft: palette.creamSoft,
  inkFaint: palette.creamFaint,
  primary: palette.tangerineNight,
  primaryEdge: palette.tangerineDeep,
  onPrimary: palette.plum,
  owed: palette.mintNight,
  owedFill: palette.mintNightFill,
  owe: palette.berryNight,
  oweFill: palette.berryNightFill,
  highlight: palette.sunflower,
  focus: palette.sunflower,
  scrim: 'rgba(0, 0, 0, 0.6)',
};

/** Colors avatars and group covers draw from, picked by hashing an id. */
export const avatarPalette = [
  { fill: '#FF6A3D', ink: '#2D1537' },
  { fill: '#3DD6A3', ink: '#2D1537' },
  { fill: '#FFC93C', ink: '#2D1537' },
  { fill: '#F0507A', ink: '#2D1537' },
  { fill: '#A98BFF', ink: '#2D1537' },
  { fill: '#1FA2A6', ink: '#FFF4E6' },
  { fill: '#5B2A6E', ink: '#FFF4E6' },
  { fill: '#FFB38A', ink: '#2D1537' },
] as const;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const fonts = {
  displayMedium: 'Fredoka-Medium',
  display: 'Fredoka-SemiBold',
  displayBold: 'Fredoka-Bold',
  body: 'Nunito-Regular',
  bodySemi: 'Nunito-SemiBold',
  bodyBold: 'Nunito-Bold',
  bodyHeavy: 'Nunito-ExtraBold',
} as const;

/**
 * Type scale. Fredoka (rounded, chunky) for display text and hero numbers; Nunito for
 * everything read in lists, because its default figures are tabular and amounts line up.
 */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 52, lineHeight: 58, letterSpacing: -1 },
  display: { fontFamily: fonts.display, fontSize: 36, lineHeight: 42, letterSpacing: -0.5 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26 },
  subheading: { fontFamily: fonts.displayMedium, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: fonts.bodySemi, fontSize: 13, lineHeight: 18 },
  overline: { fontFamily: fonts.bodyHeavy, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  amount: {
    fontFamily: fonts.bodyHeavy,
    fontSize: 16,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

export interface Theme {
  dark: boolean;
  colors: Colors;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? { dark: true, colors: dark } : { dark: false, colors: light };
}

/** Content never stretches wider than a phone, even in a desktop browser. */
export const MAX_CONTENT_WIDTH = 560;

import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import { useTheme } from './theme';

/**
 * Spot illustrations for empty states. One shared style: a 3px plum (or cream, in dark
 * mode) outline with round joins, flat fills from the avatar palette, and the torn receipt
 * as the recurring object.
 */
const accent = {
  tangerine: '#FF6A3D',
  mint: '#3DD6A3',
  sunflower: '#FFC93C',
  berry: '#F0507A',
  lilac: '#A98BFF',
  teal: '#1FA2A6',
};

/** Illustrations are decoration: hidden from screen readers, which get the copy beside them. */
function Decorative({ children }: { children: ReactNode }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      {children}
    </View>
  );
}

interface IllustrationProps {
  size?: number;
}

function useStroke() {
  const { colors } = useTheme();
  return {
    stroke: colors.ink,
    strokeWidth: 3,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    paper: colors.surface,
  };
}

/** Receipt outline with a zigzag tear along the bottom edge. */
function receiptPath(x: number, y: number, w: number, h: number, teeth = 6) {
  const step = w / teeth;
  let d = `M${x} ${y} H${x + w} V${y + h}`;
  for (let i = teeth; i > 0; i--) {
    const peakX = x + (i - 0.5) * step;
    d += ` L${peakX} ${y + h - 7} L${x + (i - 1) * step} ${y + h}`;
  }
  return `${d} Z`;
}

function Sparkle({
  x,
  y,
  r = 6,
  color = accent.sunflower,
}: {
  x: number;
  y: number;
  r?: number;
  color?: string;
}) {
  return (
    <Path
      d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z`}
      fill={color}
    />
  );
}

/** No groups yet: a receipt splitting into strips that run to three friends. */
export function GroupsIllustration({ size = 220 }: IllustrationProps) {
  const s = useStroke();
  return (
    <Decorative>
      <Svg width={size} height={size * 0.73} viewBox="0 0 220 160">
        <G
          stroke={s.stroke}
          strokeWidth={s.strokeWidth}
          strokeLinecap={s.strokeLinecap}
          strokeLinejoin={s.strokeLinejoin}
        >
          <Path
            d="M84 92 C70 112 52 118 38 128"
            fill="none"
            stroke={accent.tangerine}
            strokeWidth={9}
          />
          <Path
            d="M110 96 C110 112 110 120 110 128"
            fill="none"
            stroke={accent.mint}
            strokeWidth={9}
          />
          <Path
            d="M136 92 C150 112 168 118 182 128"
            fill="none"
            stroke={accent.lilac}
            strokeWidth={9}
          />
          <Path d={receiptPath(74, 18, 72, 78)} fill={s.paper} transform="rotate(-4 110 57)" />
          <Line x1={86} y1={38} x2={122} y2={36} />
          <Line x1={86} y1={52} x2={112} y2={50} />
          <Line x1={86} y1={66} x2={128} y2={63} />
          <Circle cx={36} cy={136} r={14} fill={accent.tangerine} />
          <Circle cx={110} cy={138} r={14} fill={accent.mint} />
          <Circle cx={184} cy={136} r={14} fill={accent.lilac} />
        </G>
        <Sparkle x={160} y={26} r={8} />
        <Sparkle x={56} y={40} r={5} color={accent.berry} />
      </Svg>
    </Decorative>
  );
}

/** No expenses: an empty plate, cutlery, and a blank receipt waiting. */
export function ExpensesIllustration({ size = 200 }: IllustrationProps) {
  const s = useStroke();
  return (
    <Decorative>
      <Svg width={size} height={size * 0.73} viewBox="0 0 220 160">
        <G
          stroke={s.stroke}
          strokeWidth={s.strokeWidth}
          strokeLinecap={s.strokeLinecap}
          strokeLinejoin={s.strokeLinejoin}
        >
          <Circle cx={96} cy={92} r={52} fill={accent.sunflower} />
          <Circle cx={96} cy={92} r={34} fill={s.paper} />
          <Path d="M30 52 V132 M22 52 V72 Q30 82 38 72 V52" fill="none" />
          <Path d="M162 52 Q178 70 166 96 V132" fill="none" />
          <Path d={receiptPath(158, 18, 44, 52, 4)} fill={s.paper} transform="rotate(8 180 44)" />
          <Line x1={168} y1={34} x2={190} y2={37} />
          <Line x1={167} y1={46} x2={182} y2={48} />
        </G>
        <Sparkle x={140} y={140} r={7} color={accent.tangerine} />
      </Svg>
    </Decorative>
  );
}

/** Everyone is square: two friends, a check mark, and confetti. */
export function SettledIllustration({ size = 200 }: IllustrationProps) {
  const s = useStroke();
  return (
    <Decorative>
      <Svg width={size} height={size * 0.73} viewBox="0 0 220 160">
        <G
          stroke={s.stroke}
          strokeWidth={s.strokeWidth}
          strokeLinecap={s.strokeLinecap}
          strokeLinejoin={s.strokeLinejoin}
        >
          <Circle cx={70} cy={92} r={34} fill={accent.mint} />
          <Circle cx={150} cy={92} r={34} fill={accent.tangerine} />
          <Circle cx={110} cy={52} r={22} fill={s.paper} />
          <Path d="M99 52 L107 60 L122 44" fill="none" />
          <Path d="M30 30 L40 36" />
          <Path d="M186 28 L178 38" />
          <Path d="M196 70 L206 66" />
        </G>
        <Rect
          x={22}
          y={60}
          width={10}
          height={10}
          fill={accent.lilac}
          transform="rotate(20 27 65)"
        />
        <Rect
          x={184}
          y={110}
          width={9}
          height={9}
          fill={accent.berry}
          transform="rotate(-15 188 114)"
        />
        <Sparkle x={52} y={140} r={7} />
        <Sparkle x={168} y={146} r={5} color={accent.teal} />
      </Svg>
    </Decorative>
  );
}

/** Scanning: a phone over a receipt with a sweeping scan line. */
export function ScanIllustration({ size = 180 }: IllustrationProps) {
  const s = useStroke();
  return (
    <Decorative>
      <Svg width={size} height={size * 0.73} viewBox="0 0 220 160">
        <G
          stroke={s.stroke}
          strokeWidth={s.strokeWidth}
          strokeLinecap={s.strokeLinecap}
          strokeLinejoin={s.strokeLinejoin}
        >
          <Path d={receiptPath(50, 20, 76, 118, 7)} fill={s.paper} transform="rotate(-6 88 79)" />
          <Line x1={62} y1={44} x2={104} y2={40} />
          <Line x1={64} y1={60} x2={96} y2={57} />
          <Line x1={66} y1={76} x2={110} y2={72} />
          <Line x1={68} y1={92} x2={100} y2={89} />
          <Rect x={112} y={34} width={64} height={110} rx={14} fill={accent.lilac} />
          <Rect x={120} y={46} width={48} height={80} rx={6} fill={s.paper} />
          <Line x1={116} y1={84} x2={172} y2={84} stroke={accent.tangerine} strokeWidth={5} />
        </G>
        <Sparkle x={190} y={30} r={8} />
      </Svg>
    </Decorative>
  );
}

/** Not found: a lone receipt scrap with a question mark. */
export function LostIllustration({ size = 200 }: IllustrationProps) {
  const s = useStroke();
  return (
    <Decorative>
      <Svg width={size} height={size * 0.73} viewBox="0 0 220 160">
        <G
          stroke={s.stroke}
          strokeWidth={s.strokeWidth}
          strokeLinecap={s.strokeLinecap}
          strokeLinejoin={s.strokeLinejoin}
        >
          <Path d={receiptPath(70, 24, 80, 96, 6)} fill={s.paper} transform="rotate(10 110 72)" />
          <Path
            d="M98 58 Q100 44 114 46 Q128 50 122 62 Q118 68 112 72 V80"
            fill="none"
            stroke={accent.tangerine}
            strokeWidth={6}
          />
          <Circle cx={112} cy={94} r={3.5} fill={accent.tangerine} stroke={accent.tangerine} />
          <Path d="M40 140 Q80 128 110 138 T180 136" fill="none" strokeDasharray="2 10" />
        </G>
        <Sparkle x={44} y={40} r={7} color={accent.mint} />
        <Sparkle x={178} y={46} r={5} />
      </Svg>
    </Decorative>
  );
}

/** A person with no shared expenses yet. */
export function PersonIllustration({ size = 160 }: IllustrationProps) {
  const s = useStroke();
  return (
    <Decorative>
      <Svg width={size} height={size * 0.73} viewBox="0 0 220 160">
        <G
          stroke={s.stroke}
          strokeWidth={s.strokeWidth}
          strokeLinecap={s.strokeLinecap}
          strokeLinejoin={s.strokeLinejoin}
        >
          <Circle cx={110} cy={80} r={56} fill="none" strokeDasharray="3 11" />
          <Circle cx={110} cy={66} r={20} fill={accent.sunflower} />
          <Path d="M74 118 Q110 80 146 118" fill={accent.teal} />
        </G>
        <Sparkle x={170} y={36} r={7} color={accent.tangerine} />
      </Svg>
    </Decorative>
  );
}

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { Text } from './Text';
import { avatarPalette, fonts, useTheme } from './theme';

export interface AvatarProps {
  /** A stable id: the same person always gets the same colors and pattern. */
  seed: string;
  name: string;
  size?: number;
  /** Draws a ring, used for the active person while assigning items. */
  ringed?: boolean;
}

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * Generated avatars: a color and one of six geometric patterns, both picked from a hash of
 * the person's id, with their initials on top. No photos and no emoji, and two friends
 * named Sam still look different.
 */
export const Avatar = memo(function Avatar({ seed, name, size = 40, ringed = false }: AvatarProps) {
  const { colors } = useTheme();
  const h = hash(seed);
  const base = avatarPalette[h % avatarPalette.length]!;
  const accent = avatarPalette[(h >>> 3) % avatarPalette.length]!;
  const accentFill =
    accent.fill === base.fill ? avatarPalette[(h + 3) % avatarPalette.length]!.fill : accent.fill;
  const pattern = (h >>> 7) % 6;
  const rotation = ((h >>> 11) % 4) * 90;
  const clipId = `clip-${seed}`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.frame,
        { width: size, height: size, borderRadius: size / 2 },
        ringed && { borderWidth: 3, borderColor: colors.ink, padding: 2 },
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 40 40">
        <Defs>
          <ClipPath id={clipId}>
            <Circle cx={20} cy={20} r={20} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          <Rect width={40} height={40} fill={base.fill} />
          <G transform={`rotate(${rotation} 20 20)`} opacity={0.55}>
            {pattern === 0 && <Circle cx={34} cy={34} r={16} fill={accentFill} />}
            {pattern === 1 && (
              <Path
                d="M-4 30 L30 -4 L38 -4 L-4 38 Z M8 44 L44 8 L44 16 L16 44 Z"
                fill={accentFill}
              />
            )}
            {pattern === 2 && (
              <G fill={accentFill}>
                <Circle cx={8} cy={8} r={3} />
                <Circle cx={20} cy={6} r={3} />
                <Circle cx={32} cy={8} r={3} />
                <Circle cx={6} cy={32} r={3} />
                <Circle cx={34} cy={32} r={3} />
              </G>
            )}
            {pattern === 3 && <Path d="M0 40 A20 20 0 0 1 40 40 Z" fill={accentFill} />}
            {pattern === 4 && (
              <Path
                d="M40 0 A40 40 0 0 0 0 40 L8 40 A32 32 0 0 1 40 8 Z M40 16 A24 24 0 0 0 16 40 L24 40 A16 16 0 0 1 40 24 Z"
                fill={accentFill}
              />
            )}
            {pattern === 5 && <Path d="M0 40 L20 22 L40 40 Z" fill={accentFill} />}
          </G>
        </G>
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.center}>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: fonts.display,
              color: base.ink,
              fontSize: size * 0.38,
              lineHeight: size * 0.46,
            }}
          >
            {initialsOf(name)}
          </Text>
        </View>
      </View>
    </View>
  );
});

export interface AvatarStackProps {
  people: { id: string; name: string }[];
  size?: number;
  max?: number;
}

export function AvatarStack({ people, size = 28, max = 4 }: AvatarStackProps) {
  const { colors } = useTheme();
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <View style={styles.stack} accessibilityLabel={people.map((p) => p.name).join(', ')}>
      {shown.map((person, index) => (
        <View
          key={person.id}
          style={{
            marginLeft: index === 0 ? 0 : -size * 0.3,
            borderRadius: size,
            borderWidth: 2,
            borderColor: colors.surface,
          }}
        >
          <Avatar seed={person.id} name={person.name} size={size} />
        </View>
      ))}
      {extra > 0 ? (
        <View
          style={[
            styles.more,
            {
              width: size + 4,
              height: size + 4,
              borderRadius: size,
              marginLeft: -size * 0.3,
              backgroundColor: colors.sunken,
              borderColor: colors.surface,
            },
          ]}
        >
          <Text variant="caption" tone="soft" allowFontScaling={false}>
            +{extra}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stack: { flexDirection: 'row', alignItems: 'center' },
  more: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});

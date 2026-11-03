import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/ui/Text';
import { avatarPalette, fonts } from '@/ui/theme';

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** A group's mark: a little torn receipt stub in a color picked from the group id. */
export function GroupBadge({ id, name, size = 52 }: { id: string; name: string; size?: number }) {
  const color = avatarPalette[hash(id) % avatarPalette.length]!;
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 52 52">
        <Path
          d="M8 2 H44 Q50 2 50 8 V46 L45 42 L39 48 L33 42 L26 48 L19 42 L13 48 L7 42 L2 46 V8 Q2 2 8 2 Z"
          fill={color.fill}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: fonts.displayBold,
            fontSize: size * 0.42,
            color: color.ink,
            marginTop: -size * 0.06,
          }}
        >
          {initial}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });

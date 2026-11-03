import type { LucideIcon } from 'lucide-react-native';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { radius, space, useTheme } from './theme';

export interface BannerProps {
  tone: 'info' | 'success' | 'warning';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  testID?: string;
}

const icons: Record<BannerProps['tone'], LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
};

export function Banner({ tone, title, children, action, testID }: BannerProps) {
  const { colors } = useTheme();
  const Icon = icons[tone];
  const fill = { info: colors.sunken, success: colors.owedFill, warning: colors.oweFill }[tone];
  const ink = { info: colors.ink, success: colors.owed, warning: colors.owe }[tone];
  return (
    <View
      testID={testID}
      accessibilityRole={tone === 'warning' ? 'alert' : undefined}
      style={[styles.base, { backgroundColor: fill }]}
    >
      <Icon size={20} color={ink} strokeWidth={2.4} />
      <View style={styles.body}>
        <Text variant="label" style={{ color: ink }}>
          {title}
        </Text>
        {children ? (
          <Text variant="caption" tone="soft">
            {children}
          </Text>
        ) : null}
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md },
  body: { flex: 1, gap: space.xs },
});

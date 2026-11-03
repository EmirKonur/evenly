import { ScrollView, StyleSheet, View } from 'react-native';

import type { Person } from '@/data/types';
import { Avatar } from '@/ui/Avatar';
import { haptics } from '@/ui/haptics';
import { PressableScale } from '@/ui/PressableScale';
import { Text } from '@/ui/Text';
import { radius, space, useTheme } from '@/ui/theme';

export function PayerPicker({
  members,
  value,
  onChange,
}: {
  members: Person[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text variant="label" tone="soft">
        Paid by
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityRole="radiogroup"
      >
        {members.map((member) => {
          const selected = member.id === value;
          const name = member.isSelf ? 'You' : member.name;
          return (
            <PressableScale
              key={member.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${name} paid`}
              onPress={() => {
                haptics.select();
                onChange(member.id);
              }}
              focusRadius={radius.pill}
              testID={`payer-${member.name}`}
            >
              <View
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.ink : colors.line,
                    backgroundColor: selected ? colors.ink : colors.surface,
                  },
                ]}
              >
                <Avatar seed={member.id} name={member.name} size={30} />
                <Text variant="label" style={{ color: selected ? colors.background : colors.ink }}>
                  {name}
                </Text>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { gap: space.sm, paddingRight: space.xl },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.xs,
    paddingRight: space.md,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
});

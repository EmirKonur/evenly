import { Users } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

import type { GroupLedger, Person } from '@/data/types';
import { cents, computeSplit, formatMoney, receiptTotal, type Cents } from '@/money';
import { Avatar } from '@/ui/Avatar';
import { haptics } from '@/ui/haptics';
import { Money } from '@/ui/Money';
import { springs } from '@/ui/motion';
import { PressableScale } from '@/ui/PressableScale';
import { Text } from '@/ui/Text';
import { radius, space, useTheme } from '@/ui/theme';

import { useReceiptDraft, type ReceiptDraft } from './draftStore';

type Active = string | 'everyone' | null;
type Measurable = ComponentRef<typeof View>;

interface Flight {
  key: number;
  person: Person;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** What each person owes for the items assigned so far, extras included. */
export function runningTotals(draft: ReceiptDraft): Map<string, Cents> {
  const assigned = draft.items.filter((item) => item.assigneeIds.length > 0);
  const lines = assigned.map((item) => ({
    id: item.id,
    price: item.price,
    assignees: item.assigneeIds,
  }));
  if (lines.length === 0) return new Map();
  const result = computeSplit(receiptTotal(lines, draft.extras), {
    mode: 'itemized',
    items: lines,
    extras: draft.extras,
  });
  return result.ok
    ? new Map(result.shares.map((share) => [share.personId, share.amount]))
    : new Map();
}

export interface AssignmentBoardProps {
  ledger: GroupLedger;
  draft: ReceiptDraft;
}

/**
 * Pick a person in the tray, then tap their items. Each assignment launches a copy of the
 * person's chip from the tray to the item it landed on, so it is obvious what the tap did.
 * The flight is decoration on top of an immediate state change, and it is skipped
 * entirely when the OS asks for reduced motion.
 */
export function AssignmentBoard({ ledger, draft }: AssignmentBoardProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const toggleAssignee = useReceiptDraft((s) => s.toggleAssignee);
  const setAssignees = useReceiptDraft((s) => s.setAssignees);
  const [active, setActive] = useState<Active>(ledger.members[0]?.id ?? null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [hint, setHint] = useState(false);
  const overlay = useRef<Measurable>(null);
  const chipRefs = useRef(new Map<string, Measurable>());
  const slotRefs = useRef(new Map<string, Measurable>());
  const flightKey = useRef(0);

  const currency = ledger.group.currency;
  const totals = runningTotals(draft);
  const assignedCount = draft.items.filter((item) => item.assigneeIds.length > 0).length;
  const complete = assignedCount === draft.items.length && draft.items.length > 0;
  const wasComplete = useRef(complete);
  useEffect(() => {
    if (complete && !wasComplete.current) haptics.success();
    wasComplete.current = complete;
  }, [complete]);

  const launch = (person: Person, itemId: string) => {
    const chip = chipRefs.current.get(person.id);
    const slot = slotRefs.current.get(itemId);
    const host = overlay.current;
    if (reduceMotion || !chip || !slot || !host) return;
    host.measureInWindow((hx, hy) => {
      chip.measureInWindow((cx, cy, cw, ch) => {
        slot.measureInWindow((sx, sy, sw, sh) => {
          const key = ++flightKey.current;
          const flight = {
            key,
            person,
            from: { x: cx - hx + cw / 2, y: cy - hy + ch / 2 },
            to: { x: sx - hx + sw - 14, y: sy - hy + sh / 2 },
          };
          setFlights((list) => [...list, flight]);
          setTimeout(() => setFlights((list) => list.filter((f) => f.key !== key)), 520);
        });
      });
    });
  };

  const tapItem = (itemId: string) => {
    const item = draft.items.find((i) => i.id === itemId);
    if (!item) return;
    if (active === null) {
      haptics.warning();
      setHint(true);
      return;
    }
    haptics.tap();
    if (active === 'everyone') {
      const everyone = ledger.members.map((m) => m.id);
      setAssignees(itemId, item.assigneeIds.length === everyone.length ? [] : everyone);
      return;
    }
    const person = ledger.members.find((m) => m.id === active);
    if (!person) return;
    if (!item.assigneeIds.includes(person.id)) launch(person, itemId);
    toggleAssignee(itemId, person.id);
  };

  return (
    <View style={styles.root} ref={overlay} collapsable={false}>
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <Text variant="body" tone="soft" style={styles.intro}>
          Pick a person below, then tap everything they had. Shared plates can have several people;
          the price splits evenly between them.
        </Text>
        {draft.items.map((item) => {
          const assignees = item.assigneeIds
            .map((id) => ledger.members.find((m) => m.id === id))
            .filter((m): m is Person => m !== undefined);
          const mine =
            typeof active === 'string' &&
            active !== 'everyone' &&
            item.assigneeIds.includes(active);
          const names = assignees.map((p) => (p.isSelf ? 'you' : p.name)).join(', ');
          return (
            <PressableScale
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${formatMoney(item.price, currency)}. ${assignees.length ? `Shared by ${names}` : 'Not assigned yet'}.`}
              accessibilityHint={
                active ? 'Toggles the selected person on this item' : 'Pick a person first'
              }
              onPress={() => tapItem(item.id)}
              scaleTo={0.97}
              focusRadius={radius.lg}
              testID={`assign-item-${item.name}`}
            >
              <View
                style={[
                  styles.item,
                  {
                    backgroundColor: colors.surface,
                    borderColor: mine
                      ? colors.ink
                      : assignees.length
                        ? colors.line
                        : colors.primary,
                    borderStyle: assignees.length ? 'solid' : 'dashed',
                  },
                ]}
              >
                <View style={styles.itemText}>
                  <Text variant="bodyStrong" numberOfLines={2}>
                    {item.quantity > 1 ? `${item.quantity} × ` : ''}
                    {item.name}
                  </Text>
                  <Money amount={item.price} currency={currency} tone="soft" variant="caption" />
                </View>
                <View
                  style={styles.slot}
                  collapsable={false}
                  ref={(node) => {
                    if (node) slotRefs.current.set(item.id, node);
                    else slotRefs.current.delete(item.id);
                  }}
                >
                  {assignees.length === 0 ? (
                    <Text variant="caption" tone="faint">
                      Tap to assign
                    </Text>
                  ) : (
                    assignees.map((person, index) => (
                      <Animated.View
                        key={person.id}
                        entering={ZoomIn.delay(reduceMotion ? 0 : 300)
                          .springify()
                          .damping(12)}
                        exiting={ZoomOut.duration(150)}
                        style={{
                          marginLeft: index === 0 ? 0 : -10,
                          borderRadius: 20,
                          borderWidth: 2,
                          borderColor: colors.surface,
                        }}
                      >
                        <Avatar seed={person.id} name={person.name} size={30} />
                      </Animated.View>
                    ))
                  )}
                </View>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>

      <View
        style={[styles.tray, { backgroundColor: colors.background, borderTopColor: colors.line }]}
      >
        <View style={styles.trayHeader}>
          <Text variant="label" tone={hint ? 'owe' : 'soft'} accessibilityLiveRegion="polite">
            {hint && active === null
              ? 'Pick a person first'
              : `${assignedCount} of ${draft.items.length} items assigned`}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {ledger.members.map((person) => (
            <PersonChip
              key={person.id}
              person={person}
              active={active === person.id}
              total={totals.get(person.id) ?? cents(0)}
              currency={currency}
              onPress={() => {
                haptics.select();
                setHint(false);
                setActive(active === person.id ? null : person.id);
              }}
              register={(node) => {
                if (node) chipRefs.current.set(person.id, node);
                else chipRefs.current.delete(person.id);
              }}
            />
          ))}
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ selected: active === 'everyone' }}
            accessibilityLabel="Everyone: tap an item to share it with the whole group"
            onPress={() => {
              haptics.select();
              setActive(active === 'everyone' ? null : 'everyone');
            }}
            focusRadius={radius.lg}
            testID="assign-everyone"
          >
            <View
              style={[
                styles.chip,
                {
                  borderColor: active === 'everyone' ? colors.ink : colors.line,
                  backgroundColor: active === 'everyone' ? colors.highlight : colors.surface,
                },
              ]}
            >
              <View style={[styles.everyone, { backgroundColor: colors.sunken }]}>
                <Users size={20} color={colors.ink} strokeWidth={2.25} />
              </View>
              <Text variant="label">Everyone</Text>
            </View>
          </PressableScale>
        </ScrollView>
      </View>

      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {flights.map((flight) => (
          <FlyingChip key={flight.key} flight={flight} />
        ))}
      </View>
    </View>
  );
}

function PersonChip({
  person,
  active,
  total,
  currency,
  onPress,
  register,
}: {
  person: Person;
  active: boolean;
  total: Cents;
  currency: GroupLedger['group']['currency'];
  onPress: () => void;
  register: (node: Measurable | null) => void;
}) {
  const { colors } = useTheme();
  const lift = useSharedValue(0);
  useEffect(() => {
    lift.set(withSpring(active ? -6 : 0, springs.pop));
  }, [active, lift]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));
  const name = person.isSelf ? 'You' : person.name;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${name}, ${formatMoney(total, currency)} so far`}
      onPress={onPress}
      focusRadius={radius.lg}
      testID={`assign-person-${person.name}`}
    >
      <Animated.View style={style}>
        <View
          style={[
            styles.chip,
            {
              borderColor: active ? colors.ink : colors.line,
              backgroundColor: active ? colors.highlight : colors.surface,
            },
          ]}
        >
          <View ref={register} collapsable={false}>
            <Avatar seed={person.id} name={person.name} size={40} ringed={active} />
          </View>
          <View>
            <Text variant="label" style={{ color: active ? '#2D1537' : colors.ink }}>
              {name}
            </Text>
            <Money
              amount={total}
              currency={currency}
              variant="caption"
              style={{ color: active ? '#2D1537' : colors.inkSoft }}
              testID={`assign-total-${person.name}`}
            />
          </View>
        </View>
      </Animated.View>
    </PressableScale>
  );
}

/** A copy of a person's avatar arcing from the tray to the item it was assigned to. */
function FlyingChip({ flight }: { flight: Flight }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withSpring(1, springs.fly));
  }, [progress]);
  const { from, to } = flight;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const lift = Math.sin(Math.min(p, 1) * Math.PI) * 90;
    return {
      opacity: p > 0.92 ? Math.max(0, (1 - p) * 12) : 1,
      transform: [
        { translateX: from.x + (to.x - from.x) * p - 20 },
        { translateY: from.y + (to.y - from.y) * p - lift - 20 },
        { scale: 1 - 0.25 * p },
      ],
    };
  });
  return (
    <Animated.View style={[styles.flying, style]}>
      <Avatar seed={flight.person.id} name={flight.person.name} size={40} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: {
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  intro: { marginBottom: space.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    paddingLeft: space.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    minHeight: 64,
  },
  itemText: { flex: 1, gap: 2 },
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 72,
    minHeight: 34,
  },
  tray: { borderTopWidth: 1, paddingTop: space.md, gap: space.sm },
  trayHeader: { paddingHorizontal: space.xl },
  chips: {
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: space.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
    paddingLeft: space.xs,
    paddingRight: space.md,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  everyone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flying: { position: 'absolute', left: 0, top: 0 },
});

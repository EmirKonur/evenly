import type { WithSpringConfig } from 'react-native-reanimated';

/** Springs with a little overshoot: lively, but they settle fast enough not to feel slow. */
export const springs = {
  press: { damping: 18, stiffness: 420, mass: 0.6 },
  pop: { damping: 12, stiffness: 260, mass: 0.7 },
  fly: { damping: 16, stiffness: 140, mass: 0.9 },
} satisfies Record<string, WithSpringConfig>;

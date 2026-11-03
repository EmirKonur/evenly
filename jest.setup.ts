import type { ComponentType } from 'react';

/**
 * A small stand-in for Reanimated. Its own Jest setup expects a DOM, which the React Native
 * test environment does not have. Components here only use shared values, animated styles,
 * springs, and layout animation builders, so motion-off equivalents are enough: values
 * apply instantly and entering/exiting/layout props are ignored.
 */
jest.mock('react-native-reanimated', () => {
  const { forwardRef, createElement } = jest.requireActual<typeof import('react')>('react');
  const { View, Text, ScrollView } =
    jest.requireActual<typeof import('react-native')>('react-native');

  const builder: unknown = new Proxy(() => builder, { get: () => () => builder });
  const strip = ({ entering: _e, exiting: _x, layout: _l, ...props }: Record<string, unknown>) =>
    props;
  const animated = (Component: string | ComponentType<Record<string, unknown>>) =>
    forwardRef((props: Record<string, unknown>, ref) =>
      createElement(Component, { ...strip(props), ref } as Record<string, unknown>),
    );

  return {
    __esModule: true,
    default: {
      View: animated(View),
      Text: animated(Text),
      ScrollView: animated(ScrollView),
      createAnimatedComponent: animated,
    },
    createAnimatedComponent: animated,
    useSharedValue: (initial: unknown) => {
      let value = initial;
      return { get: () => value, set: (next: unknown) => (value = next) };
    },
    useAnimatedStyle: (factory: () => object) => factory(),
    useReducedMotion: () => true,
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown) => value,
    FadeIn: builder,
    FadeInDown: builder,
    FadeOut: builder,
    FadeOutDown: builder,
    FadeOutRight: builder,
    LinearTransition: builder,
    ZoomIn: builder,
    ZoomOut: builder,
  };
});

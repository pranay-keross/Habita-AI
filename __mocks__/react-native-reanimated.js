// Manual jest mock for react-native-reanimated.
//
// The real package eagerly initializes a native worklets runtime at import
// time, which doesn't exist under Jest and crashes even the package's own
// shipped `react-native-reanimated/mock` (v4 split the worklet runtime into
// react-native-worklets, and that native module load now happens before any
// jest-environment check). This mock reimplements just the surface this repo
// uses, in plain JS, so screens that import Reanimated can still be rendered
// and snapshot-tested.
const React = require('react');
const RN = require('react-native');

function createAnimatedComponent(Component) {
  return React.forwardRef((props, ref) => React.createElement(Component, { ...props, ref }));
}

const Animated = {
  View: RN.View,
  Text: RN.Text,
  Image: RN.Image,
  ScrollView: RN.ScrollView,
  createAnimatedComponent,
};

function useSharedValue(initial) {
  return React.useRef({ value: initial }).current;
}

function useAnimatedStyle(fn) {
  return fn();
}

function useAnimatedScrollHandler() {
  // No scroll simulation under jest — return a no-op native event handler.
  return () => {};
}

function useDerivedValue(fn) {
  return useSharedValue(fn());
}

function interpolate(value, inputRange, outputRange, extrapolate) {
  const clamp = extrapolate === 'clamp' || extrapolate === 0;
  const last = inputRange.length - 1;
  if (value <= inputRange[0]) return clamp ? outputRange[0] : outputRange[0];
  if (value >= inputRange[last]) return clamp ? outputRange[last] : outputRange[last];
  for (let i = 0; i < last; i++) {
    if (value >= inputRange[i] && value <= inputRange[i + 1]) {
      const ratio = (value - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
      return outputRange[i] + ratio * (outputRange[i + 1] - outputRange[i]);
    }
  }
  return outputRange[last];
}

const Extrapolation = { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' };

function withSpring(toValue) {
  return toValue;
}

function withTiming(toValue) {
  return toValue;
}

// Chainable no-op builder for entering/exiting/layout animation props —
// the test renderer doesn't run animations, it just needs the chain to exist.
function makeAnimationBuilder() {
  const builder = {};
  ['duration', 'delay', 'springify', 'damping', 'stiffness', 'easing', 'mass', 'randomDelay'].forEach((method) => {
    builder[method] = () => builder;
  });
  return builder;
}

module.exports = {
  ...Animated,
  default: Animated,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  useDerivedValue,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  FadeIn: makeAnimationBuilder(),
  FadeInDown: makeAnimationBuilder(),
  FadeInUp: makeAnimationBuilder(),
  FadeOut: makeAnimationBuilder(),
  SlideInDown: makeAnimationBuilder(),
  SlideInRight: makeAnimationBuilder(),
};

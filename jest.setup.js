/* eslint-env jest */

// Native modules have no binary in the jest environment, so each package that
// reaches for one is swapped for the mock it ships.

require('react-native-gesture-handler/jestSetup');

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

// react-native-reanimated is mocked via __mocks__/react-native-reanimated.js
// (Jest picks up node_modules manual mocks from the root __mocks__ dir
// automatically — no explicit jest.mock() call needed here).

// The shipped mock is a default-exported object, but consumers use named
// imports (SafeAreaProvider, useSafeAreaInsets) — unwrap it.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

// @react-native-community/geolocation ships no jest mock of its own (only stale .d.ts
// typings for one) — without this, importing it in a test environment throws
// "doesn't seem to be linked" because it reaches for the native module at import time.
jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  requestAuthorization: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
  setRNConfiguration: jest.fn(),
}));

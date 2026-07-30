/* eslint-env jest */

// Native modules have no binary in the jest environment, so each package that
// reaches for one is swapped for the mock it ships.

require('react-native-gesture-handler/jestSetup');

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

// The shipped mock is a default-exported object, but consumers use named
// imports (SafeAreaProvider, useSafeAreaInsets) — unwrap it.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

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

// Unlike geolocation above, this one ships its own jest mock — same underlying reason
// (reaches for a native module at import time), different fix.
jest.mock('@react-native-community/datetimepicker', () =>
  require('@react-native-community/datetimepicker/jest/index'),
);

// This one also ships a jest mock, but as a `setupFiles`-style script that calls
// `jest.mock()` on its own internal (deep, build-output) module paths rather than
// exporting a drop-in replacement — too fragile to `require()` inline here. Hand-rolled
// instead, same shape as the geolocation mock above.
jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(),
  isErrorWithCode: jest.fn().mockReturnValue(false),
  errorCodes: { OPERATION_CANCELED: 'OPERATION_CANCELED' },
  types: { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', images: 'image/*' },
}));

// `DocViewerScreen` imports react-native-pdf, which pulls in react-native-blob-util,
// which constructs a `NativeEventEmitter` over a null native module at import time —
// so merely *reaching* the screen throws, taking the App smoke test and the
// themed-styles sweep down with it. Neither suite exercises PDF rendering; they only
// need the module to import. Mocked rather than transformed (adding both to
// `transformIgnorePatterns` gets past the ESM syntax error and straight into the
// NativeEventEmitter one).
jest.mock('react-native-pdf', () => ({ __esModule: true, default: () => null }));

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    fs: { dirs: {}, exists: jest.fn(async () => false), unlink: jest.fn(async () => undefined) },
    config: jest.fn(() => ({ fetch: jest.fn(async () => ({ path: () => '' })) })),
  },
}));

// @react-native-firebase and @notifee both reach for native binaries at import
// time. Mocked here rather than left to fail, so `firebaseMessaging.ts` — the
// newest and least build-verified code in the app — can actually be exercised
// (docs/DECISIONS.md D-059). Each listener registration returns its unsubscribe,
// matching the real API, so a test can assert teardown.
jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({ name: '[DEFAULT]' })),
}));

jest.mock('@react-native-firebase/messaging', () => {
  const unsub = () => jest.fn();
  return {
    AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
    getMessaging: jest.fn(() => ({})),
    getToken: jest.fn(async () => 'test-fcm-token'),
    requestPermission: jest.fn(async () => 1),
    onMessage: jest.fn(() => unsub()),
    onNotificationOpenedApp: jest.fn(() => unsub()),
    onTokenRefresh: jest.fn(() => unsub()),
    getInitialNotification: jest.fn(async () => null),
    setBackgroundMessageHandler: jest.fn(),
  };
});

// The trigger-notification half is what `features/notifications/localScheduler.ts`
// drives for document-expiry and staff-salary reminders. `getTriggerNotificationIds`
// returns a real (mutable) array rather than `[]` so a test can assert that a
// reschedule cancels the group's stale ids and leaves other groups alone.
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async () => 'habita_alerts'),
    displayNotification: jest.fn(async () => 'notif-id'),
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
    onForegroundEvent: jest.fn(() => jest.fn()),
    createTriggerNotification: jest.fn(async () => 'trigger-id'),
    cancelTriggerNotification: jest.fn(async () => undefined),
    getTriggerNotificationIds: jest.fn(async () => []),
    cancelAllNotifications: jest.fn(async () => undefined),
    // Defaults to AUTHORIZED so tests exercise the granted path. A test that
    // cares about the prompt-once behaviour overrides it per case.
    getNotificationSettings: jest.fn(async () => ({ authorizationStatus: 1 })),
  },
  AndroidImportance: { HIGH: 4, DEFAULT: 3 },
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 },
  EventType: { PRESS: 1, DISMISSED: 0, DELIVERED: 3 },
  TriggerType: { TIMESTAMP: 0, INTERVAL: 1 },
  // Exact values matter: SET_AND_ALLOW_WHILE_IDLE (1) needs no permission, while
  // the SET_EXACT* variants require SCHEDULE_EXACT_ALARM on Android 12+.
  AlarmType: {
    SET: 0,
    SET_AND_ALLOW_WHILE_IDLE: 1,
    SET_EXACT: 2,
    SET_EXACT_AND_ALLOW_WHILE_IDLE: 3,
    SET_ALARM_CLOCK: 4,
  },
  RepeatFrequency: { HOURLY: 0, DAILY: 1, WEEKLY: 2 },
}));

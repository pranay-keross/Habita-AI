/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';
import { handleBackgroundMessage } from './src/features/notifications/backgroundHandler';

// Must be registered here, at module scope outside React: when a data message
// arrives with the app backgrounded or killed, the OS spins up a headless JS
// context that never mounts the component tree, so a handler installed inside a
// screen or a hook is never reached and the message is dropped. Registering it
// after `AppRegistry.registerComponent` is also too late on a cold start.
// See docs/DECISIONS.md D-059.
try {
  setBackgroundMessageHandler(getMessaging(), handleBackgroundMessage);
} catch {
  // No Firebase configured for this build (iOS today) — the app runs without push.
}

AppRegistry.registerComponent(appName, () => App);

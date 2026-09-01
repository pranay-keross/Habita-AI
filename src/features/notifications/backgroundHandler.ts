import { parsePushPayload } from './parse';
import { addNotification, loadNotifications, saveNotifications } from './notificationStore';

/**
 * Handles a data message that arrived with the app backgrounded or killed.
 *
 * This runs in a headless JS context: no component tree, no React state, and no
 * `useSyncExternalStore` subscribers to notify — so it reads and writes
 * AsyncStorage directly rather than going through `inbox.ts`. The next launch
 * hydrates from that same store, which is how a notification received overnight
 * is still in the Medicine screen's alert list in the morning.
 *
 * FCM gives this handler a limited window and treats a rejected promise as a
 * failed delivery, so it must never throw: an unparseable message is a no-op.
 *
 * Notifee is deliberately not called here to draw anything. A message with a
 * `notification` block is already drawn by the OS, and drawing a second one from
 * this handler is the standard way integrations end up showing every background
 * alert twice.
 */
export async function handleBackgroundMessage(message: {
  data?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const payload = message?.data ? parsePushPayload(message.data) : null;
    if (!payload) {
      return;
    }
    const stored = await loadNotifications();
    const next = addNotification(stored, payload);
    if (next !== stored) {
      await saveNotifications(next);
    }
  } catch {
    // Never reject: FCM reads a rejection as a failed delivery and may retry.
  }
}

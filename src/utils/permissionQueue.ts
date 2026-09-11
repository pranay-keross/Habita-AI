/**
 * Serializes runtime permission requests, app-wide.
 *
 * **The bug this exists to prevent.** Android shows one permission dialog at a
 * time. A second `requestPermissions` call made while another dialog is open is
 * discarded by the framework — the callback fires with `PERMISSION_DENIED` and no
 * UI is ever shown. The caller cannot tell that apart from a real refusal.
 *
 * That is exactly what happened here on a fresh install: the Profile screen asks
 * for `ACCESS_FINE_LOCATION` while `usePushRegistration` asks for
 * `POST_NOTIFICATIONS`, both moments after sign-in. Location won, notifications
 * was dropped, and the app recorded "already asked" — so the user saw the
 * location dialog, never the notification one, and never would again.
 *
 * It only reproduced on a *clean* install, because once location is granted its
 * request returns instantly without a dialog and there is nothing to collide
 * with. That is why it looked intermittent.
 *
 * Every caller of `PermissionsAndroid.request` must go through here. One at a
 * time, in call order, regardless of which feature asked.
 */

/**
 * Tail of the queue. Each task chains onto the previous one's settlement — note
 * `.then(task, task)`, so a rejected predecessor still lets the next request run
 * rather than stalling every future permission behind one failure.
 */
let tail: Promise<unknown> = Promise.resolve();

/**
 * Runs `task` once no other queued permission request is in flight.
 *
 * Rejections propagate to the caller unchanged — the queue's own bookkeeping
 * swallows them separately so one failed request cannot poison the chain.
 */
export function requestPermissionExclusively<T>(task: () => Promise<T>): Promise<T> {
  const result = tail.then(task, task);
  tail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** Test seam — drops any queued work so cases cannot leak into each other. */
export function resetPermissionQueueForTests(): void {
  tail = Promise.resolve();
}

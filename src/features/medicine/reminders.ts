import {
  alertId,
  cancelGroup,
  scheduleGroup,
  type LocalAlert,
} from '../notifications/localScheduler';
import type { DosageReminderPush } from '../notifications/types';
import { SCHEDULE_SLOTS, slotTime, type Medicine, type ScheduleSlot } from './types';

/**
 * Dose reminders, scheduled on this device.
 *
 * **Why this file exists.** `DOSAGE_REMINDER` was only ever a payload the *backend*
 * sends — the client could receive and route one, but nothing anywhere scheduled
 * one. So adding a medicine with an 08:00 slot produced no reminder at 08:00, and
 * no amount of Firebase configuration would have changed that: there was nothing
 * to deliver. `node scripts/check-push-setup.js` passes every static check on this
 * repo, which is exactly why the failure was confusing.
 *
 * **Why local rather than waiting for the server.** A notifee trigger is held by
 * the OS, not by the app process. That is what makes it fire when the app is in
 * the foreground, in the background, *and* fully killed — the three states the
 * reminder has to work in, and the reason a server round trip is not actually
 * required for a time the device already knows.
 *
 * Same shape as the document and salary reminders (D-061): a pure builder plus a
 * sync call, emitting the identical payload the backend will send, so when a
 * server-side scheduler does arrive both paths parse, dedupe, file into the inbox
 * and route on tap through one code path.
 *
 * **One caveat, stated because it is not obvious.** Android drops scheduled alarms
 * on reboot. `RECEIVE_BOOT_COMPLETED` lets notifee restore them; the app also
 * re-syncs on every launch and on every Medicine screen load, so a reboot costs at
 * most the reminders between the restart and the next time the app is opened.
 */

/** Repeats daily, so one trigger covers every future day of that dose. */
const REPEAT_DAILY = true;

/**
 * The next moment `HH:MM` occurs, in the device's own timezone.
 *
 * Built from local date parts rather than `new Date("...")` for the same reason the
 * rest of this codebase does: a bare date string parses as UTC. Rolls to tomorrow
 * once today's time has passed, so scheduling at 09:00 for an 08:00 dose sets
 * tomorrow's 08:00 rather than firing immediately for a dose already taken.
 */
export function nextOccurrence(time: string, now: number = Date.now()): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  const base = new Date(now);
  const at = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hours,
    minutes,
    0,
    0,
  );
  if (at.getTime() <= now) {
    at.setDate(at.getDate() + 1);
  }
  return at.getTime();
}

/**
 * Every dose reminder the chest warrants.
 *
 * Pure — no storage, no notifee, no `Date.now()` — so the awkward cases (a dose
 * time already past today, a malformed custom time, a medicine with no schedule)
 * are testable without a clock.
 */
export function buildDoseAlerts(
  medicines: Medicine[],
  now: number = Date.now(),
): LocalAlert[] {
  const alerts: LocalAlert[] = [];

  for (const medicine of medicines) {
    if (!medicine.name?.trim() || !Array.isArray(medicine.schedule)) {
      continue;
    }
    // Iterated in slot order rather than over `medicine.schedule` directly, so a
    // duplicated slot in stored data cannot produce two triggers for one dose.
    for (const slot of SCHEDULE_SLOTS) {
      if (!medicine.schedule.includes(slot as ScheduleSlot)) {
        continue;
      }
      const fireAt = nextOccurrence(slotTime(medicine, slot), now);
      if (fireAt === null) {
        // A malformed custom time is a data problem with one slot, not a reason to
        // drop this medicine's other doses or anyone else's.
        continue;
      }
      const payload: DosageReminderPush = {
        type: 'DOSAGE_REMINDER',
        medicineName: medicine.name.trim(),
        clickAction: 'OPEN_DOSAGE_SCREEN',
      };
      alerts.push({
        // Keyed on medicine + slot, so re-syncing replaces this dose's trigger
        // instead of stacking another one beside it.
        id: alertId('medicine', medicine.id, slot),
        payload,
        fireAt,
        repeatDaily: REPEAT_DAILY,
      });
    }
  }

  return alerts;
}

/**
 * Recomputes and reschedules every dose reminder from the current chest.
 *
 * Safe to call on every load, add, edit and delete: `scheduleGroup` replaces the
 * whole `medicine` group and the ids are stable per medicine per slot, so repeated
 * calls converge instead of multiplying. That is also what makes deleting a
 * medicine cancel its reminders with no separate teardown path to forget.
 *
 * Returns how many triggers are now scheduled, which the Medicine screen shows so
 * "reminders are on" is a verifiable claim rather than a promise.
 */
export async function syncDoseReminders(medicines: Medicine[]): Promise<number> {
  if (medicines.length === 0) {
    await cancelGroup('medicine');
    return 0;
  }
  return scheduleGroup('medicine', buildDoseAlerts(medicines));
}

/** Cancels every dose reminder — used when the user turns them off. */
export async function cancelDoseReminders(): Promise<void> {
  await cancelGroup('medicine');
}

/**
 * Re-arms dose reminders from the local cache, at app launch.
 *
 * Two failure modes this covers, both invisible without it:
 *
 * 1. **Reboot.** Android discards scheduled alarms on restart. Re-syncing at
 *    launch means a reboot costs only the doses between the restart and the next
 *    time the app is opened, instead of silently ending reminders forever.
 * 2. **Never opening the Medicine screen.** The screen's own effect is what
 *    normally schedules these; a user who takes the same tablet daily has no
 *    reason to visit it, and their reminders should not depend on doing so.
 *
 * Reads the local store directly rather than the network: this runs before
 * sign-in resolves, and last known doses are a better basis for a reminder than
 * none. Failures are swallowed — a missing cache at first launch is normal, not
 * an error worth surfacing.
 */
export async function resyncDoseRemindersFromCache(): Promise<number> {
  try {
    const { loadMedicines } = await import('./medicineStore');
    const stored = await loadMedicines();
    return await syncDoseReminders(stored);
  } catch {
    return 0;
  }
}

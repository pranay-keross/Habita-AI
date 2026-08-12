import { getItem, setItem } from '../../utils/storage';
import type { IntakeLogEntry, Medicine, ScheduleSlot } from './types';

export const MEDICINE_STORAGE_KEY = 'habita.medicines';
export const INTAKE_LOG_STORAGE_KEY = 'habita.medicine_intake_log';

export async function loadMedicines(): Promise<Medicine[]> {
  return getItem<Medicine[]>(MEDICINE_STORAGE_KEY, []);
}

export async function saveMedicines(medicines: Medicine[]): Promise<void> {
  await setItem(MEDICINE_STORAGE_KEY, medicines);
}

export async function loadIntakeLog(): Promise<IntakeLogEntry[]> {
  return getItem<IntakeLogEntry[]>(INTAKE_LOG_STORAGE_KEY, []);
}

export async function saveIntakeLog(log: IntakeLogEntry[]): Promise<void> {
  await setItem(INTAKE_LOG_STORAGE_KEY, log);
}

// Expected doses over the trailing 7 days = each medicine's scheduled slots per day,
// times 7 — a simplification that assumes today's medicine list held for the whole
// window, which is fine at this scale and avoids reconstructing historical schedules.
// Returns null (not 0%) when there is nothing to measure yet, so callers can show an
// empty state instead of a misleading percentage.
export function calculateAdherence(
  medicines: Medicine[],
  log: IntakeLogEntry[],
  now: number = Date.now(),
): number | null {
  if (medicines.length === 0) {
    return null;
  }
  const expectedPerDay = medicines.reduce((sum, m) => sum + m.schedule.length, 0);
  if (expectedPerDay === 0) {
    return null;
  }
  const windowStart = now - 7 * 24 * 60 * 60 * 1000;
  const taken = log.filter((entry) => entry.takenAt >= windowStart && entry.takenAt <= now).length;
  const expected = expectedPerDay * 7;
  return Math.min(100, Math.round((taken / expected) * 100));
}

export function isTakenToday(
  log: IntakeLogEntry[],
  medicineId: string,
  slot: ScheduleSlot,
  now: number = Date.now(),
): boolean {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  return log.some(
    (entry) => entry.medicineId === medicineId && entry.slot === slot && entry.takenAt >= startOfDay.getTime(),
  );
}

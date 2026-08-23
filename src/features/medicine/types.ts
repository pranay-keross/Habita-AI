export type ScheduleSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export const SCHEDULE_SLOTS: ScheduleSlot[] = ['morning', 'afternoon', 'evening', 'night'];

export function timeToSlot(time: string): ScheduleSlot {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  schedule: ScheduleSlot[];
  // Custom "HH:MM" time per selected slot, overriding that slot's default
  // representative time. Missing entries fall back to the slot's default.
  scheduleTimes?: Partial<Record<ScheduleSlot, string>>;
  // `null` means the backend has no confirmed count for this medicine yet — the case
  // right after prescription-parsing auto-creates it, before the user has confirmed how
  // much they actually have.
  stock: number | null;
  // Whether stock/quantity is tracked as a liquid volume (ml) rather than a unit count
  // (tablets/capsules). The backend has no such field on `Medicine` — this is a
  // client-only label, persisted locally per medicine id (see `medicineStore.ts`) and
  // merged back in on every refresh so it survives navigation/app restarts.
  isLiquid: boolean;
}

export interface IntakeLogEntry {
  id: string;
  medicineId: string;
  slot: ScheduleSlot;
  takenAt: number; // epoch ms
}

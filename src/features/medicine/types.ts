export type ScheduleSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export const SCHEDULE_SLOTS: ScheduleSlot[] = ['morning', 'afternoon', 'evening', 'night'];

export interface Medicine {
  id: string;
  name: string;
  dosage: string;
  schedule: ScheduleSlot[];
  stock: number;
}

export interface IntakeLogEntry {
  id: string;
  medicineId: string;
  slot: ScheduleSlot;
  takenAt: number; // epoch ms
}

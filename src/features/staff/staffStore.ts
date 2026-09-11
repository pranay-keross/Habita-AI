import { getItem, setItem } from '../../utils/storage';
import type {
  AttendanceEntry,
  Caregiver,
  CaregiverTransaction,
  PayrollSettings,
  SalaryPayment,
} from './types';
import { DEFAULT_PAYROLL_SETTINGS } from './types';

export const CAREGIVER_STORAGE_KEY = 'habita.caregivers';
export const CAREGIVER_TRANSACTION_STORAGE_KEY = 'habita.caregiver_transactions';
export const CAREGIVER_ATTENDANCE_STORAGE_KEY = 'habita.caregiver_attendance';
export const SALARY_PAYMENT_STORAGE_KEY = 'habita.staff_salary_payments';
export const PAYROLL_SETTINGS_STORAGE_KEY = 'habita.staff_payroll_settings';

export async function loadCaregivers(): Promise<Caregiver[]> {
  return getItem<Caregiver[]>(CAREGIVER_STORAGE_KEY, []);
}

export async function saveCaregivers(caregivers: Caregiver[]): Promise<void> {
  await setItem(CAREGIVER_STORAGE_KEY, caregivers);
}

export async function loadCaregiverTransactions(): Promise<CaregiverTransaction[]> {
  return getItem<CaregiverTransaction[]>(CAREGIVER_TRANSACTION_STORAGE_KEY, []);
}

export async function saveCaregiverTransactions(transactions: CaregiverTransaction[]): Promise<void> {
  await setItem(CAREGIVER_TRANSACTION_STORAGE_KEY, transactions);
}

export async function loadAttendanceEntries(): Promise<AttendanceEntry[]> {
  return getItem<AttendanceEntry[]>(CAREGIVER_ATTENDANCE_STORAGE_KEY, []);
}

export async function saveAttendanceEntries(entries: AttendanceEntry[]): Promise<void> {
  await setItem(CAREGIVER_ATTENDANCE_STORAGE_KEY, entries);
}

export async function loadSalaryPayments(): Promise<SalaryPayment[]> {
  return getItem<SalaryPayment[]>(SALARY_PAYMENT_STORAGE_KEY, []);
}

export async function saveSalaryPayments(payments: SalaryPayment[]): Promise<void> {
  await setItem(SALARY_PAYMENT_STORAGE_KEY, payments);
}

/**
 * Merged against the defaults field-by-field rather than spread, for the same
 * reason `loadDocReminderSettings` does it: settings written by an earlier build
 * are missing keys a later one divides by, and `standardHoursPerDay: undefined`
 * reaching `overtimeRateFor` produces `NaN` on a payslip.
 */
export async function loadPayrollSettings(): Promise<PayrollSettings> {
  const stored = await getItem<Partial<PayrollSettings>>(PAYROLL_SETTINGS_STORAGE_KEY, {});
  const num = (value: unknown, fallback: number, min: number): number =>
    typeof value === 'number' && Number.isFinite(value) && value >= min ? value : fallback;
  return {
    paidLeaveDaysPerMonth: num(
      stored?.paidLeaveDaysPerMonth,
      DEFAULT_PAYROLL_SETTINGS.paidLeaveDaysPerMonth,
      0,
    ),
    // Guarded above zero, not just non-negative: it is a divisor in
    // `overtimeRateFor`, and zero there yields Infinity on a real payslip.
    standardHoursPerDay: num(
      stored?.standardHoursPerDay,
      DEFAULT_PAYROLL_SETTINGS.standardHoursPerDay,
      0.5,
    ),
    overtimeMultiplier: num(
      stored?.overtimeMultiplier,
      DEFAULT_PAYROLL_SETTINGS.overtimeMultiplier,
      0,
    ),
    salaryReminderLeadDays: num(
      stored?.salaryReminderLeadDays,
      DEFAULT_PAYROLL_SETTINGS.salaryReminderLeadDays,
      0,
    ),
    remindersEnabled:
      typeof stored?.remindersEnabled === 'boolean'
        ? stored.remindersEnabled
        : DEFAULT_PAYROLL_SETTINGS.remindersEnabled,
  };
}

export async function savePayrollSettings(settings: PayrollSettings): Promise<void> {
  await setItem(PAYROLL_SETTINGS_STORAGE_KEY, settings);
}

import type {
  AttendanceEntry,
  Caregiver,
  CaregiverTransaction,
  PayrollSettings,
  Payslip,
  PayslipStatus,
  SalaryPayment,
} from './types';
import { DEFAULT_PAYROLL_SETTINGS } from './types';

/**
 * Household staff payroll.
 *
 * What this replaces: the staff card used to show `caregiver.rate + extras` as
 * the amount payable. That figure ignored absences, leave, half-days, overtime
 * and the hourly rate type entirely — a member who worked four days in a month
 * and one who worked thirty produced the same number. A Wise Home ships
 * "monthly payment calculation with unpaid leaves factored" and "attendance,
 * including half-days and overtime, hourly rates"; see
 * `docs/AWH_FEATURE_GAP_ANALYSIS.md` §1.3 gaps 3.2 and 3.3.
 *
 * Every function here is pure. No storage, no network, no `Date.now()` — the
 * month and the clock are always arguments. Payroll is the one part of this app
 * that produces a number someone is owed, so it is the one part that has to be
 * exhaustively testable, and the same rules are written out in §3.2 of the gap
 * analysis for the backend to implement identically. When
 * `GET /staff/{staffId}/payroll` ships, this becomes the offline fallback rather
 * than dead code — the same shape `LocalCbtCoach` has in the wellness module.
 */

/** Fallback for a present day on an hourly rate with no hours recorded. */
export const DEFAULT_WORKING_HOURS = 8;

/** `2026-09` for a Date, in local time — never `toISOString()`, which is UTC. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Calendar days in `YYYY-MM`. Leap years included, because February matters here. */
export function daysInMonth(month: string): number {
  const [year, mon] = month.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(mon) || mon < 1 || mon > 12) {
    return 30;
  }
  return new Date(year, mon, 0).getDate();
}

/** Last calendar day of the month, `YYYY-MM-DD` — when a monthly salary falls due. */
export function monthEndDate(month: string): string {
  return `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
}

/** True for a `YYYY-MM-DD` inside `YYYY-MM`. String comparison, so no timezone to get wrong. */
function isInMonth(isoDate: string, month: string): boolean {
  return isoDate.startsWith(`${month}-`);
}

/**
 * Rounds money to 2 decimals.
 *
 * `perDay` is a repeating decimal for most salary/day-count pairs (12000/31), and
 * summing unrounded thirds is how a payslip ends up owing ₹12,299.999999999998.
 * Rounded once at each money boundary rather than only at the end, so every line
 * the user can see adds up to the total they can see.
 */
function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface AttendanceTally {
  presentDays: number;
  halfDays: number;
  leaveDays: number;
  absentDays: number;
  markedDays: number;
  hoursWorked: number;
  overtimeHours: number;
}

/**
 * Counts one member's month.
 *
 * Deduplicates by date, keeping the latest mark: the attendance UI lets a day be
 * re-marked (present -> half day, say) and the store appends rather than
 * replaces, so a naive count would pay the same day twice.
 */
export function tallyAttendance(
  entries: AttendanceEntry[],
  caregiverId: string,
  month: string,
): AttendanceTally {
  const latestByDate = new Map<string, AttendanceEntry>();
  for (const entry of entries) {
    if (entry.caregiverId !== caregiverId || !isInMonth(entry.date, month)) {
      continue;
    }
    const existing = latestByDate.get(entry.date);
    if (!existing || entry.markedAt >= existing.markedAt) {
      latestByDate.set(entry.date, entry);
    }
  }

  const tally: AttendanceTally = {
    presentDays: 0,
    halfDays: 0,
    leaveDays: 0,
    absentDays: 0,
    markedDays: latestByDate.size,
    hoursWorked: 0,
    overtimeHours: 0,
  };

  for (const entry of latestByDate.values()) {
    switch (entry.status) {
      case 'present':
        tally.presentDays += 1;
        tally.hoursWorked += entry.hoursWorked ?? DEFAULT_WORKING_HOURS;
        break;
      case 'halfDay':
        tally.halfDays += 1;
        tally.hoursWorked += entry.hoursWorked ?? DEFAULT_WORKING_HOURS / 2;
        break;
      case 'leave':
        tally.leaveDays += 1;
        break;
      case 'absent':
        tally.absentDays += 1;
        break;
    }
    // Counted for every status, not just present: overtime on a day marked as a
    // half day is real work and is exactly the case a "present days" count loses.
    tally.overtimeHours += entry.overtimeHours ?? 0;
  }

  return tally;
}

/**
 * The hourly rate overtime is paid at.
 *
 * For an hourly member it is their own rate; for a monthly member it is derived
 * from the daily rate, which is the only defensible way to price an hour of
 * someone paid by the month.
 */
export function overtimeRateFor(
  caregiver: Caregiver,
  payableDays: number,
  settings: PayrollSettings,
): number {
  if (caregiver.rateType === 'hourly') {
    return money(caregiver.rate * settings.overtimeMultiplier);
  }
  const perDay = caregiver.rate / payableDays;
  return money((perDay / settings.standardHoursPerDay) * settings.overtimeMultiplier);
}

/**
 * Builds one member's payslip for one month.
 *
 * The rules, stated once so they can be checked against §3.2 of the gap analysis:
 *
 * - **Monthly.** Gross is the full base rate. `perDay = baseRate / payableDays`.
 *   Deduction is a full day for each absence and each unpaid leave day, and half a
 *   day for each half day.
 * - **Paid leave first.** `paidLeaveDaysPerMonth` days of leave cost nothing;
 *   only leave beyond the allowance becomes an unpaid deduction. Absence is never
 *   covered by the allowance — that distinction is the entire reason `leave` and
 *   `absent` are separate statuses.
 * - **Hourly.** Gross is `rate × hoursWorked`. Nothing is deducted for an absence,
 *   because an hour not worked was never earned — deducting as well would charge
 *   the member twice for one missed day.
 * - **Overtime is additive** in both cases, at `overtimeRateFor`.
 * - **Unmarked days are not present.** A month with no attendance marked pays a
 *   monthly member in full (nothing is *known* to be missed) and an hourly member
 *   nothing, and `unmarkedDays` reports the gap so the household can see why.
 */
export function buildPayslip(
  caregiver: Caregiver,
  month: string,
  attendance: AttendanceEntry[],
  adjustments: CaregiverTransaction[],
  payments: SalaryPayment[],
  settings: PayrollSettings = DEFAULT_PAYROLL_SETTINGS,
): Payslip {
  const payableDays = daysInMonth(month);
  const tally = tallyAttendance(attendance, caregiver.id, month);

  const paidLeaveUsed = Math.min(tally.leaveDays, settings.paidLeaveDaysPerMonth);
  const unpaidLeaveDays = tally.leaveDays - paidLeaveUsed;

  const overtimeRate = overtimeRateFor(caregiver, payableDays, settings);
  const overtimePay = money(overtimeRate * tally.overtimeHours);

  let grossPay: number;
  let deductions: number;

  if (caregiver.rateType === 'hourly') {
    grossPay = money(caregiver.rate * tally.hoursWorked);
    deductions = 0;
  } else {
    const perDay = caregiver.rate / payableDays;
    grossPay = money(caregiver.rate);
    deductions = money(
      perDay * (unpaidLeaveDays + tally.absentDays) + perDay * 0.5 * tally.halfDays,
    );
  }

  // Ad-hoc extras (bonus, rainy-day allowance, overtime money entered by hand
  // before this engine existed) still count, and are still signed — a negative
  // amount is an advance or a deduction.
  const adjustmentTotal = money(
    adjustments
      .filter((tx) => tx.caregiverId === caregiver.id)
      .reduce((sum, tx) => sum + tx.amount, 0),
  );

  // Floored at zero: deductions plus a large advance can mathematically exceed
  // gross, but "you owe your cook ₹-800" is not a thing a payslip should ever
  // say. The carry-over case belongs to the backend contract, not to a local
  // month-at-a-time computation.
  const netPayable = money(
    Math.max(0, grossPay - deductions + overtimePay + adjustmentTotal),
  );

  const paidAmount = money(
    payments
      .filter((p) => p.caregiverId === caregiver.id && p.month === month)
      .reduce((sum, p) => sum + p.amount, 0),
  );
  const outstanding = money(Math.max(0, netPayable - paidAmount));

  let status: PayslipStatus;
  if (paidAmount <= 0) {
    status = 'UNPAID';
  } else if (outstanding <= 0) {
    status = 'PAID';
  } else {
    status = 'PARTIALLY_PAID';
  }

  return {
    caregiverId: caregiver.id,
    name: caregiver.name,
    month,
    rateType: caregiver.rateType,
    baseRate: caregiver.rate,
    payableDays,
    presentDays: tally.presentDays,
    halfDays: tally.halfDays,
    leaveDays: tally.leaveDays,
    paidLeaveAllowance: settings.paidLeaveDaysPerMonth,
    paidLeaveUsed,
    unpaidLeaveDays,
    absentDays: tally.absentDays,
    unmarkedDays: Math.max(0, payableDays - tally.markedDays),
    hoursWorked: money(tally.hoursWorked),
    overtimeHours: money(tally.overtimeHours),
    overtimeRate,
    grossPay,
    deductions,
    overtimePay,
    adjustments: adjustmentTotal,
    netPayable,
    paidAmount,
    outstanding,
    dueDate: monthEndDate(month),
    status,
  };
}

/** Every member's payslip for one month — what the staff list renders from. */
export function buildPayrollRun(
  caregivers: Caregiver[],
  month: string,
  attendance: AttendanceEntry[],
  adjustments: CaregiverTransaction[],
  payments: SalaryPayment[],
  settings: PayrollSettings = DEFAULT_PAYROLL_SETTINGS,
): Payslip[] {
  return caregivers.map((c) =>
    buildPayslip(c, month, attendance, adjustments, payments, settings),
  );
}

/** Total still owed across the household for a month — the staff screen's header figure. */
export function totalOutstanding(payslips: Payslip[]): number {
  return money(payslips.reduce((sum, p) => sum + p.outstanding, 0));
}

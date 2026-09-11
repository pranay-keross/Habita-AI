export type CaregiverRateType = 'hourly' | 'monthly';

export interface Caregiver {
  id: string;
  name: string;
  service: string;
  rateType: CaregiverRateType;
  rate: number;
  phone: string;
  notes: string;
  createdAt: number;
}

export interface CaregiverTransaction {
  id: string;
  caregiverId: string;
  amount: number;
  reason: string;
  createdAt: number;
}

export type AttendanceStatus = 'present' | 'absent' | 'leave' | 'halfDay';

export interface AttendanceEntry {
  id: string;
  caregiverId: string;
  date: string; // "YYYY-MM-DD", local calendar day
  status: AttendanceStatus;
  markedAt: number;
  /**
   * Hours actually worked that day. Only meaningful for an hourly-rate member,
   * where pay is hours × rate and a "present" with no hours earns nothing.
   * Optional so every attendance row written before payroll existed still loads;
   * `payroll.ts` falls back to `DEFAULT_WORKING_HOURS` for a present day with no
   * figure rather than paying zero for work that was done.
   */
  hoursWorked?: number;
  /**
   * Overtime beyond the normal day, paid on top for both rate types. A Wise Home
   * bills this as a first-class part of attendance ("including half-days and
   * overtime"); it used to exist here only as a free-text "extra" whose amount
   * the user had to compute themselves.
   */
  overtimeHours?: number;
}

/** A salary payment actually made — distinct from `CaregiverTransaction`, which is an adjustment. */
export interface SalaryPayment {
  id: string;
  caregiverId: string;
  /** `YYYY-MM` — the payroll month this settles, not the date it was paid. */
  month: string;
  amount: number;
  method: PaymentMethod;
  paidOn: string; // "YYYY-MM-DD"
  reference: string;
  createdAt: number;
}

export type PaymentMethod = 'UPI' | 'CASH' | 'BANK_TRANSFER';

export const PAYMENT_METHODS: PaymentMethod[] = ['UPI', 'CASH', 'BANK_TRANSFER'];

export type PayslipStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

/**
 * One staff member's pay for one month, fully itemised.
 *
 * Every intermediate figure is kept rather than just `netPayable`, because the
 * number this produces is money owed to a person who will ask how it was reached
 * — "₹12,300" alone is not something a household can defend, and the deductions
 * are exactly the part that causes disputes.
 *
 * Matches the `GET /staff/{staffId}/payroll` response contract in
 * `docs/AWH_FEATURE_GAP_ANALYSIS.md` §3.2 B4 field-for-field, so the screen does
 * not change shape when the server-computed version replaces the local one.
 */
export interface Payslip {
  caregiverId: string;
  name: string;
  month: string; // "YYYY-MM"
  rateType: CaregiverRateType;
  baseRate: number;

  /** Calendar days in the month — the divisor for a monthly rate. */
  payableDays: number;
  presentDays: number;
  halfDays: number;
  leaveDays: number;
  paidLeaveAllowance: number;
  paidLeaveUsed: number;
  unpaidLeaveDays: number;
  absentDays: number;
  /** Days in the month with no attendance marked at all — surfaced, never assumed. */
  unmarkedDays: number;

  hoursWorked: number;
  overtimeHours: number;
  overtimeRate: number;

  grossPay: number;
  deductions: number;
  overtimePay: number;
  adjustments: number;

  netPayable: number;
  paidAmount: number;
  outstanding: number;
  dueDate: string; // "YYYY-MM-DD" — last day of the month
  status: PayslipStatus;
}

export interface PayrollSettings {
  /**
   * Paid leave days granted per month before leave starts costing the member
   * pay. Two is the common Indian domestic-staff norm (roughly four Sundays'
   * worth of flexibility) and is what makes "unpaid leaves factored" mean
   * anything — with an allowance of zero, `leave` and `absent` would be the same
   * status and one of them would be pointless.
   */
  paidLeaveDaysPerMonth: number;
  /** Hours in a normal working day — the divisor for a monthly member's overtime rate. */
  standardHoursPerDay: number;
  /** Multiplier on the derived hourly rate for overtime hours. */
  overtimeMultiplier: number;
  /** Fire a salary-due reminder this many days before month end. */
  salaryReminderLeadDays: number;
  remindersEnabled: boolean;
}

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  paidLeaveDaysPerMonth: 2,
  standardHoursPerDay: 8,
  overtimeMultiplier: 1,
  salaryReminderLeadDays: 2,
  remindersEnabled: true,
};

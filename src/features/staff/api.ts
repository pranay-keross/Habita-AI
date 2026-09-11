import { ApiError, apiFetch } from '../auth/api';

export interface ServiceOption {
  id: number;
  serviceName: string;
  active: boolean;
}

// Static-ish lookup for the caregiver role dropdown — not family-scoped. "Custom" (id 11)
// is a real row in this list, not a client-side sentinel, matching the add-caregiver
// contract's `customRole` field for anything not covered by the fixed service catalog.
//
// Defends against the response being wrapped (e.g. `{content: [...]}` or `{data: [...]}`,
// the shape the sibling `/staff` list endpoint uses) instead of a bare array — a mismatch
// here previously made the dropdown fail silently empty via the caller's `.catch(() => [])`.
export async function listServiceOptions(token: string): Promise<ServiceOption[]> {
  const raw = await apiFetch<unknown>('/staff/services/list', { method: 'GET', token });
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { content?: unknown })?.content)
      ? (raw as { content: unknown[] }).content
      : Array.isArray((raw as { data?: unknown })?.data)
        ? (raw as { data: unknown[] }).data
        : [];
  return (list as ServiceOption[]).filter((service) => service && service.active !== false);
}

export interface RemoteStaffMember {
  id: string;
  familyId: string;
  name: string;
  role: string;
  rateType: 'Monthly' | 'Hourly';
  phone: string;
  monthlySalary: number;
  joiningDate: string;
  active: boolean;
}

interface StaffPage {
  content: RemoteStaffMember[];
}

// The response's `content` list reflects live backend state and can change between
// calls (staff added/removed elsewhere) — callers should refetch rather than cache
// long-term. `size=100` avoids implementing pagination UI for what's expected to be a
// small per-family list.
export async function listStaff(familyId: string, token: string): Promise<RemoteStaffMember[]> {
  const page = await apiFetch<StaffPage>(`/families/${familyId}/staff?page=0&size=100`, {
    method: 'GET',
    token,
  });
  return page.content;
}

export interface CreateStaffInput {
  serviceId: number;
  name: string;
  customRole?: string;
  rateType: 'Monthly' | 'Hourly';
  phone: string;
  monthlySalary: number;
  joiningDate: string; // "YYYY-MM-DD"
  notes?: string;
}

export async function createStaff(
  familyId: string,
  input: CreateStaffInput,
  token: string,
): Promise<RemoteStaffMember> {
  return apiFetch<RemoteStaffMember>(`/families/${familyId}/staff`, {
    method: 'POST',
    body: input,
    token,
  });
}

export type RemoteAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'HALF_DAY';

export interface MarkAttendanceInput {
  date: string; // "YYYY-MM-DD"
  status: RemoteAttendanceStatus;
  note?: string;
  /**
   * Both optional and both new — see `docs/AWH_FEATURE_GAP_ANALYSIS.md` §3.2 B2.
   * A backend that predates the extended contract ignores unknown body fields,
   * so sending them is safe before the server side ships; the payroll engine
   * uses the local values either way.
   */
  hoursWorked?: number;
  overtimeHours?: number;
}

export async function markStaffAttendance(
  staffId: string,
  input: MarkAttendanceInput,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/staff/${staffId}/attendance`, {
    method: 'POST',
    body: input,
    token,
  });
}

export interface AttendanceSummary {
  staffId: string;
  name: string;
  presentDays: number;
  totalMonthlyDays: number;
}

export async function listAttendanceSummary(
  familyId: string,
  token: string,
  page = 0,
  limit = 50,
): Promise<AttendanceSummary[]> {
  return apiFetch<AttendanceSummary[]>(
    `/staff/${familyId}/attendance/list?page=${page}&limit=${limit}`,
    { method: 'GET', token },
  );
}

// ---------------------------------------------------------------------------
// Payroll — contract not yet built server-side
// ---------------------------------------------------------------------------
//
// Specified in docs/AWH_FEATURE_GAP_ANALYSIS.md §3.2 (B1, B4-B10). Every call
// below fails with a network error (ApiError status 0) until that backend is
// deployed; `StaffScreen` computes the same figures locally with
// `features/staff/payroll.ts` and treats a remote failure as "stay local", the
// same dual-mode rollout Documents and Expenses already use.
//
// The local engine and the server contract implement identical rules on purpose
// (they are written out once, in §3.2 of that document) — so when these start
// answering, the numbers do not move under the user.

export interface RemoteAttendanceEntry {
  id: string;
  staffId: string;
  date: string;
  status: RemoteAttendanceStatus;
  hoursWorked: number | null;
  overtimeHours: number | null;
  note: string | null;
}

/** B1 — per-day attendance for one member, so a payslip can be audited. */
export async function listStaffAttendance(
  staffId: string,
  month: string,
  token: string,
): Promise<RemoteAttendanceEntry[]> {
  return apiFetch<RemoteAttendanceEntry[]>(`/staff/${staffId}/attendance?month=${month}`, {
    method: 'GET',
    token,
  });
}

/** The wire form of `Payslip` — §3.2 B4. Field-for-field with `types.ts`'s local model. */
export interface RemotePayslip {
  staffId: string;
  name: string;
  month: string;
  rateType: 'MONTHLY' | 'HOURLY';
  baseRate: number;
  currency: string;
  payableDays: number;
  presentDays: number;
  halfDays: number;
  leaveDays: number;
  paidLeaveAllowance: number;
  unpaidLeaveDays: number;
  absentDays: number;
  overtimeHours: number;
  overtimeRate: number;
  grossPay: number;
  deductions: number;
  overtimePay: number;
  netPayable: number;
  paidAmount: number;
  outstanding: number;
  dueDate: string;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
}

/** B3 — every member's payslip for a month. */
export async function listFamilyPayroll(
  familyId: string,
  month: string,
  token: string,
): Promise<RemotePayslip[]> {
  return apiFetch<RemotePayslip[]>(`/families/${familyId}/payroll?month=${month}`, {
    method: 'GET',
    token,
  });
}

/** B4 — one member's payslip, itemised. */
export async function getStaffPayroll(
  staffId: string,
  month: string,
  token: string,
): Promise<RemotePayslip> {
  return apiFetch<RemotePayslip>(`/staff/${staffId}/payroll?month=${month}`, {
    method: 'GET',
    token,
  });
}

export interface RecordSalaryPaymentInput {
  month: string; // "YYYY-MM"
  amount: number;
  method: 'UPI' | 'CASH' | 'BANK_TRANSFER';
  paidOn: string; // "YYYY-MM-DD"
  reference?: string;
  /**
   * A Wise Home's "expense filing for staff and vendor payments": when true the
   * backend posts a matching row into the family expense ledger, so a salary paid
   * is a salary accounted for without the household entering it twice.
   */
  fileAsExpense?: boolean;
  expenseGroupId?: string;
}

export interface RemoteSalaryPayment {
  id: string;
  staffId: string;
  month: string;
  amount: number;
  method: string;
  paidOn: string;
  reference: string | null;
}

/** B5 — record a salary payment. */
export async function recordSalaryPayment(
  staffId: string,
  input: RecordSalaryPaymentInput,
  token: string,
): Promise<RemoteSalaryPayment> {
  return apiFetch<RemoteSalaryPayment>(`/staff/${staffId}/payments`, {
    method: 'POST',
    body: input,
    token,
  });
}

/** B6 — payment history. */
export async function listSalaryPayments(
  staffId: string,
  token: string,
  page = 0,
  size = 50,
): Promise<RemoteSalaryPayment[]> {
  const raw = await apiFetch<unknown>(
    `/staff/${staffId}/payments?page=${page}&size=${size}`,
    { method: 'GET', token },
  );
  // Same wrapped-vs-bare defence as `listServiceOptions`: the staff endpoints in
  // this API are inconsistent about paging envelopes, and a mismatch here would
  // silently render an empty payment history rather than fail visibly.
  return Array.isArray(raw)
    ? (raw as RemoteSalaryPayment[])
    : Array.isArray((raw as { content?: unknown })?.content)
      ? ((raw as { content: RemoteSalaryPayment[] }).content)
      : [];
}

export interface UpdateStaffInput {
  name?: string;
  serviceId?: number;
  customRole?: string;
  rateType?: 'Monthly' | 'Hourly';
  phone?: string;
  monthlySalary?: number;
  notes?: string;
}

/** B8 — edit a staff member. The client could previously only ever create one. */
export async function updateStaff(
  familyId: string,
  staffId: string,
  input: UpdateStaffInput,
  token: string,
): Promise<RemoteStaffMember> {
  return apiFetch<RemoteStaffMember>(`/families/${familyId}/staff/${staffId}`, {
    method: 'PUT',
    body: input,
    token,
  });
}

/** B9 — deactivate. A soft delete server-side: past payslips must stay readable. */
export async function deleteStaff(
  familyId: string,
  staffId: string,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/families/${familyId}/staff/${staffId}`, { method: 'DELETE', token });
}

export type AdjustmentKind = 'BONUS' | 'ADVANCE' | 'DEDUCTION' | 'OTHER';

export interface CreateAdjustmentInput {
  month: string;
  kind: AdjustmentKind;
  amount: number;
  reason?: string;
}

/** B10 — bonus / advance / deduction, replacing the local-only `CaregiverTransaction`. */
export async function createAdjustment(
  staffId: string,
  input: CreateAdjustmentInput,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/staff/${staffId}/adjustments`, {
    method: 'POST',
    body: input,
    token,
  });
}

export type StaffErrorKind =
  | 'network'
  | 'not_found'
  | 'no_family'
  | 'no_permission'
  | 'invalid_month'
  | 'invalid_status'
  | 'duplicate_attendance'
  | 'payment_exceeds_outstanding'
  | 'unknown';

/** Mirrors `parseVaultError` — the error codes are listed in §3.2 of the gap analysis. */
export function parseStaffError(err: unknown): StaffErrorKind {
  if (!(err instanceof ApiError)) {
    return 'unknown';
  }
  if (err.status === 0) {
    return 'network';
  }
  const body = err.body as { code?: unknown } | null;
  const code = body && typeof body.code === 'string' ? body.code : null;
  switch (code) {
    case 'STAFF_NOT_FOUND':
      return 'not_found';
    case 'NO_FAMILY':
      return 'no_family';
    case 'NOT_FAMILY_MEMBER':
      return 'no_permission';
    case 'INVALID_MONTH':
      return 'invalid_month';
    case 'INVALID_ATTENDANCE_STATUS':
      return 'invalid_status';
    case 'DUPLICATE_ATTENDANCE':
      return 'duplicate_attendance';
    case 'PAYMENT_EXCEEDS_OUTSTANDING':
      return 'payment_exceeds_outstanding';
    default:
      return 'unknown';
  }
}

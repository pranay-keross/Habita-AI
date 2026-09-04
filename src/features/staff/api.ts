import { apiFetch } from '../auth/api';

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

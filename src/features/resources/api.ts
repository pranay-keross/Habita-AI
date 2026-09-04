import { apiFetch } from '../auth/api';

export interface RemoteQuickTapItem {
  id: string;
  label: string;
  icon: string;
  supplyName: string;
}

export interface CreateQuickTapItemInput {
  label: string;
  icon: string;
  supplyName: string;
}

export async function listQuickTapItems(familyId: string, token: string): Promise<RemoteQuickTapItem[]> {
  return apiFetch<RemoteQuickTapItem[]>(`/families/${familyId}/quick-tap-items`, {
    method: 'GET',
    token,
  });
}

export async function createQuickTapItem(
  familyId: string,
  input: CreateQuickTapItemInput,
  token: string,
): Promise<RemoteQuickTapItem> {
  return apiFetch<RemoteQuickTapItem>(`/families/${familyId}/quick-tap-items`, {
    method: 'POST',
    body: input,
    token,
  });
}

export async function updateQuickTapItem(
  familyId: string,
  item: RemoteQuickTapItem,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/families/${familyId}/quick-tap-items`, {
    method: 'PUT',
    body: item,
    token,
  });
}

// Soft-delete — backend flips `active` to false rather than removing the row.
export async function deleteQuickTapItem(itemId: string, token: string): Promise<void> {
  await apiFetch<void>(`/quick-tap-items/${itemId}`, { method: 'DELETE', token });
}

export interface RemoteResourceLog {
  id: string;
  supplyName: string;
  note: string;
  loggedAt: string;
}

export interface CreateResourceLogInput {
  supplyName: string;
  quantity: number;
  note: string;
}

interface ResourceLogPage {
  content: RemoteResourceLog[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export async function createResourceLog(
  familyId: string,
  input: CreateResourceLogInput,
  token: string,
): Promise<RemoteResourceLog> {
  return apiFetch<RemoteResourceLog>(`/families/${familyId}/resource-logs`, {
    method: 'POST',
    body: input,
    token,
  });
}

export async function listResourceLogs(
  familyId: string,
  token: string,
  page = 0,
): Promise<ResourceLogPage> {
  return apiFetch<ResourceLogPage>(`/families/${familyId}/resource-logs?page=${page}`, {
    method: 'GET',
    token,
  });
}

export interface UtilityTypeOption {
  id: number;
  utilityName: string;
  active: boolean;
}

export async function listUtilityTypes(token?: string | null): Promise<UtilityTypeOption[]> {
  return apiFetch<UtilityTypeOption[]>('/families/utilities/utility-types', {
    method: 'GET',
    token: token ?? undefined,
  });
}

export interface RemoteUtilityBill {
  id: string;
  utilityType: string;
  utilityTypeName: string;
  provider: string;
  billAmount: number;
  dueDate: string;
  isPaid: boolean;
}

export interface SaveUtilityBillInput {
  utilityTypeId: number;
  provider: string;
  billAmount: number;
  dueDate: string; // "YYYY-MM-DD"
}

interface UtilityBillPage {
  content: RemoteUtilityBill[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export async function saveUtilityBill(
  familyId: string,
  input: SaveUtilityBillInput,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/families/${familyId}/utility-bill/save`, {
    method: 'POST',
    body: input,
    token,
  });
}

export async function setUtilityBillPaid(
  familyId: string,
  billId: string,
  isPaid: boolean,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/families/${familyId}/utility-bill/${billId}`, {
    method: 'PUT',
    body: { isPaid },
    token,
  });
}

export async function listUtilityBills(
  familyId: string,
  token: string,
  page = 0,
): Promise<UtilityBillPage> {
  return apiFetch<UtilityBillPage>(`/families/${familyId}/utility-bill?page=${page}`, {
    method: 'GET',
    token,
  });
}

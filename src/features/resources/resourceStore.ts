import { getItem, setItem } from '../../utils/storage';
import { isNetworkError } from '../../utils/networkStatus';
import {
  createQuickTapItem,
  createResourceLog,
  deleteQuickTapItem,
  listQuickTapItems,
  listResourceLogs,
  listUtilityBills,
  listUtilityTypes,
  saveUtilityBill,
  updateQuickTapItem,
  type RemoteQuickTapItem,
  type RemoteResourceLog,
  type RemoteUtilityBill,
} from './api';
import type {
  QuickTapItem,
  ResourceLog,
  UtilityBill,
  UtilityType,
  UtilityTypeOption,
} from './types';

export const RESOURCE_LOG_STORAGE_KEY = 'habita.resource_log';
export const QUICK_TAP_STORAGE_KEY = 'habita.quick_tap_items';
export const UTILITY_BILL_STORAGE_KEY = 'habita.utility_bills';
export const UTILITY_TYPES_STORAGE_KEY = 'habita.utility_types';
export const UTILITY_PAID_STORAGE_KEY = 'habita.utility_bills_paid';

const UTILITY_TYPE_ORDER: UtilityType[] = [
  'electricity',
  'gas',
  'internet',
  'water',
  'waste',
];

function guessUtilityType(name: string): UtilityType {
  const lower = name.toLowerCase();
  return UTILITY_TYPE_ORDER.find((type) => lower.includes(type)) ?? 'electricity';
}

function remoteQuickTapToLocal(item: RemoteQuickTapItem): QuickTapItem {
  return {
    id: item.id,
    name: item.supplyName || item.label,
    unitLabel: item.label,
    active: true,
    createdAt: Date.now(),
  };
}

function remoteResourceLogToLocal(log: RemoteResourceLog, itemId: string): ResourceLog {
  return {
    id: log.id,
    quickTapItemId: itemId,
    itemName: log.supplyName,
    quantity: 1,
    loggedAt: new Date(log.loggedAt).getTime() || Date.now(),
    note: log.note ?? '',
  };
}

async function loadPaidMap(): Promise<Record<string, boolean>> {
  return getItem<Record<string, boolean>>(UTILITY_PAID_STORAGE_KEY, {});
}

async function setPaidFlag(billId: string, paid: boolean): Promise<void> {
  const map = await loadPaidMap();
  map[billId] = paid;
  await setItem(UTILITY_PAID_STORAGE_KEY, map);
}

async function remoteUtilityBillToLocal(
  bill: RemoteUtilityBill,
  typeOptions: UtilityTypeOption[],
): Promise<UtilityBill> {
  const option = typeOptions.find((opt) => opt.id === bill.utilityTypeId);
  const paidMap = await loadPaidMap();
  return {
    id: bill.id,
    utilityTypeId: bill.utilityTypeId,
    type: option ? guessUtilityType(option.utilityName) : 'electricity',
    provider: bill.provider,
    amount: bill.billAmount,
    dueDate: bill.dueDate,
    paid: paidMap[bill.id] ?? false,
    createdAt: Date.now(),
  };
}

export async function loadUtilityTypeOptions(token?: string | null): Promise<UtilityTypeOption[]> {
  try {
    const remote = await listUtilityTypes();
    if (Array.isArray(remote)) {
      await setItem(UTILITY_TYPES_STORAGE_KEY, remote);
      return remote;
    }
  } catch {
    // Fall through to cache
  }
  return getItem<UtilityTypeOption[]>(UTILITY_TYPES_STORAGE_KEY, []);
}

export async function loadQuickTapItems(
  familyId?: string | null,
  token?: string | null,
): Promise<QuickTapItem[]> {
  if (familyId && token) {
    try {
      const remote = await listQuickTapItems(familyId, token);
      if (Array.isArray(remote)) {
        const normalized = remote.map(remoteQuickTapToLocal);
        await saveQuickTapItems(normalized);
        return normalized;
      }
    } catch {
      // Fall through to local cache
    }
  }
  return getItem<QuickTapItem[]>(QUICK_TAP_STORAGE_KEY, []);
}

export async function saveQuickTapItems(items: QuickTapItem[]): Promise<void> {
  await setItem(QUICK_TAP_STORAGE_KEY, items);
}

export async function createOrUpdateQuickTapItem(
  item: { id?: string | null; name: string; unitLabel: string },
  familyId?: string | null,
  token?: string | null,
): Promise<{ item: QuickTapItem; offline: boolean }> {
  let offline = !(familyId && token);
  if (familyId && token) {
    try {
      if (item.id) {
        await updateQuickTapItem(
          familyId,
          { id: item.id, label: item.unitLabel, icon: '', supplyName: item.name },
          token,
        );
        return {
          item: { id: item.id, name: item.name, unitLabel: item.unitLabel, active: true, createdAt: Date.now() },
          offline: false,
        };
      }
      const created = await createQuickTapItem(
        familyId,
        { label: item.unitLabel, icon: '', supplyName: item.name },
        token,
      );
      return { item: remoteQuickTapToLocal(created), offline: false };
    } catch (err) {
      offline = isNetworkError(err);
    }
  }
  return {
    item: {
      id: item.id ?? String(Date.now()),
      name: item.name,
      unitLabel: item.unitLabel,
      active: true,
      createdAt: Date.now(),
    },
    offline,
  };
}

export async function removeQuickTapItem(
  itemId: string,
  token?: string | null,
): Promise<{ offline: boolean }> {
  let offline = !token;
  if (token) {
    try {
      await deleteQuickTapItem(itemId, token);
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
    }
  }
  return { offline };
}

export async function loadResourceLogs(
  familyId?: string | null,
  token?: string | null,
): Promise<ResourceLog[]> {
  if (familyId && token) {
    try {
      const page = await listResourceLogs(familyId, token);
      if (page && Array.isArray(page.content)) {
        const items = await loadQuickTapItems(familyId, token);
        const normalized = page.content.map((log) => {
          const match = items.find((item) => item.name === log.supplyName);
          return remoteResourceLogToLocal(log, match?.id ?? '');
        });
        await saveResourceLogs(normalized);
        return normalized;
      }
    } catch {
      // Fall through to local cache
    }
  }
  return getItem<ResourceLog[]>(RESOURCE_LOG_STORAGE_KEY, []);
}

export async function saveResourceLogs(logs: ResourceLog[]): Promise<void> {
  await setItem(RESOURCE_LOG_STORAGE_KEY, logs);
}

export async function createLog(
  input: { itemName: string; quantity: number; note: string },
  familyId?: string | null,
  token?: string | null,
): Promise<{ offline: boolean }> {
  let offline = !(familyId && token);
  if (familyId && token) {
    try {
      await createResourceLog(
        familyId,
        { supplyName: input.itemName, quantity: input.quantity, note: input.note },
        token,
      );
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
    }
  }
  return { offline };
}

export async function loadUtilityBills(
  familyId?: string | null,
  token?: string | null,
): Promise<UtilityBill[]> {
  if (familyId && token) {
    try {
      const remote = await listUtilityBills(familyId, token);
      if (Array.isArray(remote)) {
        const typeOptions = await loadUtilityTypeOptions(token);
        const normalized = await Promise.all(
          remote.map((bill) => remoteUtilityBillToLocal(bill, typeOptions)),
        );
        await saveUtilityBills(normalized);
        return normalized;
      }
    } catch {
      // Fall through to local cache
    }
  }
  return getItem<UtilityBill[]>(UTILITY_BILL_STORAGE_KEY, []);
}

export async function saveUtilityBills(bills: UtilityBill[]): Promise<void> {
  await setItem(UTILITY_BILL_STORAGE_KEY, bills);
}

export async function createUtilityBill(
  input: { utilityTypeId: number | null; provider: string; amount: number; dueDate: string },
  familyId?: string | null,
  token?: string | null,
): Promise<{ offline: boolean }> {
  let offline = !(familyId && token && input.utilityTypeId != null);
  if (familyId && token && input.utilityTypeId != null) {
    try {
      await saveUtilityBill(
        familyId,
        {
          utilityTypeId: input.utilityTypeId,
          provider: input.provider,
          billAmount: input.amount,
          dueDate: input.dueDate,
        },
        token,
      );
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
    }
  }
  return { offline };
}

export async function toggleUtilityBillPaid(billId: string, paid: boolean): Promise<void> {
  await setPaidFlag(billId, paid);
}

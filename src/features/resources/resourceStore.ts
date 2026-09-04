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
  setUtilityBillPaid,
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

export const DEFAULT_QUICK_TAP_ICON = 'bolt';

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
    icon: item.icon?.trim() || DEFAULT_QUICK_TAP_ICON,
    active: true,
    createdAt: Date.now(),
  };
}

// Backend returns loggedAt as "DD-MM-YYYY hh:mm:ss am/pm", but the month field is
// corrupted (observed equal to the minutes value, e.g. "25-36-2026 10:36:44 am" for
// a log made at minute 36) — a known backend bug. Day, year, and time are reliable,
// so this reconstructs the date using those and the current month rather than
// silently falling back to `Date.now()` (which lost real chronological order
// entirely). Falls back to `Date.now()` only if day/year/time themselves don't parse.
function parseLoggedAt(value: string): number {
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)$/i.exec(
    value.trim(),
  );
  if (!match) {
    const fallback = new Date(value).getTime();
    return Number.isFinite(fallback) ? fallback : Date.now();
  }
  const [, dayStr, , yearStr, hourStr, minuteStr, secondStr, meridiem] = match;
  const day = Number(dayStr);
  const year = Number(yearStr);
  let hour = Number(hourStr) % 12;
  if (meridiem.toLowerCase() === 'pm') hour += 12;
  const now = new Date();
  const reconstructed = new Date(
    year,
    now.getMonth(),
    day,
    hour,
    Number(minuteStr),
    Number(secondStr),
  );
  return Number.isFinite(reconstructed.getTime()) ? reconstructed.getTime() : Date.now();
}

function remoteResourceLogToLocal(log: RemoteResourceLog, itemId: string): ResourceLog {
  return {
    id: log.id,
    quickTapItemId: itemId,
    itemName: log.supplyName,
    quantity: 1,
    loggedAt: parseLoggedAt(log.loggedAt),
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

function remoteUtilityBillToLocal(
  bill: RemoteUtilityBill,
  typeOptions: UtilityTypeOption[],
): UtilityBill {
  const option = typeOptions.find((opt) => opt.utilityName === bill.utilityTypeName);
  return {
    id: bill.id,
    utilityTypeId: option?.id ?? null,
    type: guessUtilityType(bill.utilityTypeName ?? bill.utilityType ?? ''),
    provider: bill.provider,
    amount: bill.billAmount,
    dueDate: bill.dueDate,
    paid: bill.isPaid,
    createdAt: Date.now(),
  };
}

export async function loadUtilityTypeOptions(token?: string | null): Promise<UtilityTypeOption[]> {
  try {
    const remote = await listUtilityTypes(token);
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
  item: { id?: string | null; name: string; unitLabel: string; icon: string },
  familyId?: string | null,
  token?: string | null,
): Promise<{ item: QuickTapItem; offline: boolean }> {
  let offline = !(familyId && token);
  if (familyId && token) {
    try {
      if (item.id) {
        await updateQuickTapItem(
          familyId,
          { id: item.id, label: item.unitLabel, icon: item.icon, supplyName: item.name },
          token,
        );
        return {
          item: { id: item.id, name: item.name, unitLabel: item.unitLabel, icon: item.icon, active: true, createdAt: Date.now() },
          offline: false,
        };
      }
      const created = await createQuickTapItem(
        familyId,
        { label: item.unitLabel, icon: item.icon, supplyName: item.name },
        token,
      );
      return { item: remoteQuickTapToLocal(created), offline: false };
    } catch (err) {
      offline = isNetworkError(err);
      if (!offline) {
        console.warn('createOrUpdateQuickTapItem: request failed', err);
      }
    }
  }
  return {
    item: {
      id: item.id ?? String(Date.now()),
      name: item.name,
      unitLabel: item.unitLabel,
      icon: item.icon,
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
      const firstPage = await listResourceLogs(familyId, token, 0);
      if (firstPage && Array.isArray(firstPage.content)) {
        const remoteLogs = [...firstPage.content];
        for (let page = 1; page < firstPage.totalPages; page += 1) {
          const next = await listResourceLogs(familyId, token, page);
          remoteLogs.push(...next.content);
        }
        const items = await loadQuickTapItems(familyId, token);
        const normalized = remoteLogs.map((log) => {
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
      const firstPage = await listUtilityBills(familyId, token, 0);
      if (firstPage && Array.isArray(firstPage.content)) {
        const remoteBills = [...firstPage.content];
        for (let page = 1; page < firstPage.totalPages; page += 1) {
          const next = await listUtilityBills(familyId, token, page);
          remoteBills.push(...next.content);
        }
        const typeOptions = await loadUtilityTypeOptions(token);
        const normalized = remoteBills.map((bill) => remoteUtilityBillToLocal(bill, typeOptions));
        await saveUtilityBills(normalized);
        return normalized;
      }
    } catch (err) {
      console.warn('loadUtilityBills: request failed', err);
    }
  } else {
    console.warn('loadUtilityBills: skipped — missing familyId or token', {
      hasFamilyId: !!familyId,
      hasToken: !!token,
    });
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
      if (!offline) {
        console.warn('createUtilityBill: request failed', err);
      }
    }
  }
  return { offline };
}

export async function toggleUtilityBillPaid(
  billId: string,
  paid: boolean,
  familyId?: string | null,
  token?: string | null,
): Promise<{ offline: boolean }> {
  await setPaidFlag(billId, paid);
  let offline = !(familyId && token);
  if (familyId && token) {
    try {
      await setUtilityBillPaid(familyId, billId, paid, token);
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
      if (!offline) {
        console.warn('toggleUtilityBillPaid: request failed', err);
      }
    }
  }
  return { offline };
}

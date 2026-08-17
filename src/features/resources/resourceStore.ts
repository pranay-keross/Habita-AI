import { getItem, setItem } from '../../utils/storage';
import type { QuickTapItem, ResourceLog } from './types';

export const RESOURCE_LOG_STORAGE_KEY = 'habita.resource_log';
export const QUICK_TAP_STORAGE_KEY = 'habita.quick_tap_items';

export async function loadResourceLogs(): Promise<ResourceLog[]> {
  return getItem<ResourceLog[]>(RESOURCE_LOG_STORAGE_KEY, []);
}

export async function saveResourceLogs(logs: ResourceLog[]): Promise<void> {
  await setItem(RESOURCE_LOG_STORAGE_KEY, logs);
}

export async function loadQuickTapItems(): Promise<QuickTapItem[]> {
  return getItem<QuickTapItem[]>(QUICK_TAP_STORAGE_KEY, []);
}

export async function saveQuickTapItems(items: QuickTapItem[]): Promise<void> {
  await setItem(QUICK_TAP_STORAGE_KEY, items);
}

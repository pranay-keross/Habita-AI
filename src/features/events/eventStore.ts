import { getItem, setItem } from '../../utils/storage';
import type { FamilyEventBudget } from './types';

const EVENT_BUDGET_STORAGE_KEY = 'habita.family_event_budgets';

export async function loadFamilyEventBudgets(): Promise<FamilyEventBudget[]> {
  return getItem<FamilyEventBudget[]>(EVENT_BUDGET_STORAGE_KEY, []);
}

export async function saveFamilyEventBudgets(
  items: FamilyEventBudget[],
): Promise<void> {
  await setItem(EVENT_BUDGET_STORAGE_KEY, items);
}

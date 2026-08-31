import { getItem, setItem } from '../../utils/storage';
import { t } from '../../i18n';
import { isNetworkError } from '../../utils/networkStatus';
import {
  createExpenseGroup,
  createGroupExpense,
  deleteExpenseGroup,
  deleteGroupExpense,
  getExpenseGroup,
  getGroupSync,
  listExpenseGroups,
  listGroupExpenses,
  listGroupSettlements,
  lookupMemberByPhone,
  recordSettlement,
} from './expenses/api';
import type {
  CreateGroupMemberInput,
  Currency,
  Expense,
  ExpenseCategory,
  ExpenseGroup,
  ExpenseSummaryStats,
  GroupMember,
  MemberBalance,
  MemberLookupResult,
  PairwiseDebt,
  RelationshipBalance,
  Settlement,
  SplitShare,
  SplitType,
} from './types';

export const GROUPS_STORAGE_KEY = 'habita.expense_groups';
export const EXPENSES_STORAGE_KEY = 'habita.expenses';
export const SETTLEMENTS_STORAGE_KEY = 'habita.settlements';

// Legacy mock IDs to automatically filter out from previous runs
const LEGACY_MOCK_GROUP_IDS = new Set(['grp_1', 'grp_2', 'grp_3']);
const LEGACY_MOCK_EXPENSE_IDS = new Set(['exp_1', 'exp_2', 'exp_3', 'exp_4']);
const LEGACY_MOCK_SETTLEMENT_IDS = new Set(['set_1']);

/**
 * Splits a rupee amount evenly across members so the shares always sum to exactly the
 * total, paisa for paisa — naively dividing (e.g. ₹100 / 3 = ₹33.33 × 3 = ₹99.99) leaves
 * a rounding gap. Works in integer paise and hands the leftover paise, one each, to the
 * first `remainder` members (by the order given) — the same "1-paise rounding
 * distribution" the backend contract in docs/EXPENSES_API_SPEC.md §5.1 requires.
 */
export function computeEqualSplitAmounts(totalINR: number, memberIds: string[]): Record<string, number> {
  const n = memberIds.length || 1;
  const totalPaise = Math.round(totalINR * 100);
  const basePaise = Math.floor(totalPaise / n);
  const remainder = totalPaise - basePaise * n;

  const result: Record<string, number> = {};
  memberIds.forEach((id, idx) => {
    const paise = basePaise + (idx < remainder ? 1 : 0);
    result[id] = paise / 100;
  });
  return result;
}

export async function loadGroups(token?: string | null): Promise<ExpenseGroup[]> {
  if (token) {
    try {
      const res = await listExpenseGroups(token);
      if (res && Array.isArray(res.groups)) {
        const normalized: ExpenseGroup[] = res.groups.map((g) => ({
          ...g,
          members: Array.isArray(g.members) ? g.members : [],
          defaultCurrency: g.defaultCurrency || 'INR',
        }));
        await saveGroups(normalized);
        return normalized;
      }
    } catch {
      // Remote call failed, fallback to local storage
    }
  }
  const data = await getItem<ExpenseGroup[] | null>(GROUPS_STORAGE_KEY, null);
  if (!data) return [];
  // Filter out legacy static mock data
  const cleaned = data.filter((g) => !LEGACY_MOCK_GROUP_IDS.has(g.id));
  if (cleaned.length !== data.length) {
    await saveGroups(cleaned);
  }
  return cleaned.map((g) => ({
    ...g,
    members: Array.isArray(g.members) ? g.members : [],
  }));
}

export async function loadExpenseSummary(token?: string | null): Promise<ExpenseSummaryStats | null> {
  if (token) {
    try {
      const res = await listExpenseGroups(token);
      if (res && res.summary) {
        return res.summary;
      }
    } catch {
      // Fall through to null
    }
  }
  return null;
}

export async function saveGroups(groups: ExpenseGroup[]): Promise<void> {
  await setItem(GROUPS_STORAGE_KEY, groups);
}

async function mergeGroupsIntoCache(fetchedGroups: ExpenseGroup[]): Promise<void> {
  const existing = (await getItem<ExpenseGroup[] | null>(GROUPS_STORAGE_KEY, null)) || [];
  const byId = new Map(existing.map((g) => [g.id, g]));
  fetchedGroups.forEach((g) => byId.set(g.id, g));
  await saveGroups(Array.from(byId.values()));
}

export interface GroupsPage {
  groups: ExpenseGroup[];
  summary: ExpenseSummaryStats | null;
  totalElements: number;
  totalPages: number;
}

/**
 * Fetches one page of groups (`page` is 1-indexed) — the `summary` is always the
 * caller's full aggregate across every group, never scoped to just this page (see
 * docs/EXPENSES_API_SPEC.md §4.1). Falls back to the full local cache, sliced
 * client-side, when offline or the request fails — there's no way to page through data
 * that was never fetched, so offline mode always works off whatever's already cached.
 */
export async function loadGroupsPage(page: number, size: number, token?: string | null): Promise<GroupsPage> {
  if (token) {
    try {
      const res = await listExpenseGroups(token, { page: page - 1, size });
      if (res && Array.isArray(res.groups)) {
        const normalized: ExpenseGroup[] = res.groups.map((g) => ({
          ...g,
          members: Array.isArray(g.members) ? g.members : [],
          defaultCurrency: g.defaultCurrency || 'INR',
        }));
        await mergeGroupsIntoCache(normalized);
        const totalElements = typeof res.totalElements === 'number' ? res.totalElements : normalized.length;
        const totalPages =
          typeof res.totalPages === 'number' && res.totalPages > 0
            ? res.totalPages
            : Math.max(1, Math.ceil(totalElements / size));
        return { groups: normalized, summary: res.summary ?? null, totalElements, totalPages };
      }
    } catch {
      // Remote call failed, fall back to local storage
    }
  }

  const all = await loadGroups();
  const totalElements = all.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const start = (page - 1) * size;
  return { groups: all.slice(start, start + size), summary: null, totalElements, totalPages };
}

export async function loadExpenses(groupId?: string, token?: string | null): Promise<Expense[]> {
  if (token && groupId) {
    try {
      const res = await listGroupExpenses(groupId, token);
      const items: Expense[] = Array.isArray(res)
        ? res
        : res && 'content' in res
        ? res.content
        : [];
      const all = await getItem<Expense[] | null>(EXPENSES_STORAGE_KEY, null);
      const otherGroups = (all || []).filter(
        (e) => e.groupId !== groupId && !LEGACY_MOCK_EXPENSE_IDS.has(e.id),
      );
      await saveExpenses([...otherGroups, ...items]);
      return items;
    } catch {
      // Fall through to local storage
    }
  }
  const data = await getItem<Expense[] | null>(EXPENSES_STORAGE_KEY, null);
  if (!data) return [];
  const cleaned = data.filter((e) => !LEGACY_MOCK_EXPENSE_IDS.has(e.id));
  if (cleaned.length !== data.length) {
    await saveExpenses(cleaned);
  }
  return groupId ? cleaned.filter((e) => e.groupId === groupId) : cleaned;
}

export async function saveExpenses(expenses: Expense[]): Promise<void> {
  await setItem(EXPENSES_STORAGE_KEY, expenses);
}

export interface ExpensesPage {
  items: Expense[];
  totalElements: number;
  totalPages: number;
}

/**
 * Fetches one page (1-indexed) of a group's expenses, most recent date first — used by
 * GroupDetailsScreen's Expenses tab so the list is driven by the backend's own
 * pagination (docs/EXPENSES_API_SPEC.md §4.3) instead of loading everything up front.
 * A backend that ignores `page`/`size` and returns a plain array is handled by slicing
 * that array client-side, so this degrades gracefully ahead of the backend catching up.
 */
export async function loadExpensesPage(
  groupId: string,
  page: number,
  size: number,
  token?: string | null,
): Promise<ExpensesPage> {
  const sortNewestFirst = (list: Expense[]) => [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (token) {
    try {
      const res = await listGroupExpenses(groupId, token, { page: page - 1, size });
      if (Array.isArray(res)) {
        const sorted = sortNewestFirst(res);
        const totalElements = sorted.length;
        const totalPages = Math.max(1, Math.ceil(totalElements / size));
        const start = (page - 1) * size;
        return { items: sorted.slice(start, start + size), totalElements, totalPages };
      }
      return {
        items: sortNewestFirst(res.content),
        totalElements: res.totalElements,
        totalPages: Math.max(1, res.totalPages),
      };
    } catch {
      // Remote call failed, fall back to local storage
    }
  }

  const all = sortNewestFirst(await loadExpenses(groupId));
  const totalElements = all.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const start = (page - 1) * size;
  return { items: all.slice(start, start + size), totalElements, totalPages };
}

export async function loadSettlements(groupId?: string, token?: string | null): Promise<Settlement[]> {
  if (token && groupId) {
    try {
      const res = await listGroupSettlements(groupId, token);
      if (Array.isArray(res)) {
        const all = await getItem<Settlement[] | null>(SETTLEMENTS_STORAGE_KEY, null);
        const otherGroups = (all || []).filter(
          (s) => s.groupId !== groupId && !LEGACY_MOCK_SETTLEMENT_IDS.has(s.id),
        );
        await saveSettlements([...otherGroups, ...res]);
        return res;
      }
    } catch {
      // Fall through to local storage
    }
  }
  const data = await getItem<Settlement[] | null>(SETTLEMENTS_STORAGE_KEY, null);
  if (!data) return [];
  const cleaned = data.filter((s) => !LEGACY_MOCK_SETTLEMENT_IDS.has(s.id));
  if (cleaned.length !== data.length) {
    await saveSettlements(cleaned);
  }
  return groupId ? cleaned.filter((s) => s.groupId === groupId) : cleaned;
}

export async function saveSettlements(settlements: Settlement[]): Promise<void> {
  await setItem(SETTLEMENTS_STORAGE_KEY, settlements);
}

/**
 * Dynamically resolves the member representing the current user in a group.
 */
export function findCurrentUserMember(
  members?: GroupMember[],
  currentUserId?: string | null,
  currentUserName?: string | null,
): GroupMember | undefined {
  if (!members || members.length === 0) return undefined;
  if (currentUserId) {
    const found = members.find((m) => m.userId === currentUserId || m.id === currentUserId);
    if (found) return found;
  }
  const owner = members.find((m) => m.isOwner);
  if (owner) return owner;
  const hasYou = members.find(
    (m) =>
      m.name.toLowerCase().includes('(you)') ||
      (currentUserName && m.name.toLowerCase().includes(currentUserName.toLowerCase())),
  );
  if (hasYou) return hasYou;
  return members[0];
}

// Calculate overall net balance for each member in a group
export function calculateGroupBalances(
  group: ExpenseGroup,
  expenses: Expense[],
  settlements: Settlement[],
): { balances: MemberBalance[]; pairwiseDebts: PairwiseDebt[] } {
  const netBalances: Record<string, number> = {};
  const members = Array.isArray(group?.members) ? group.members : [];

  // Initialize
  members.forEach((m) => {
    netBalances[m.id] = 0;
  });

  // Account for expenses
  (expenses || [])
    .filter((e) => e.groupId === group?.id)
    .forEach((e) => {
      const baseAmt = e.baseAmountINR ?? e.amount ?? 0;
      netBalances[e.paidByMemberId] = (netBalances[e.paidByMemberId] || 0) + baseAmt;

      (e.shares || []).forEach((share) => {
        netBalances[share.memberId] = (netBalances[share.memberId] || 0) - share.amount;
      });
    });

  // Account for settlements
  (settlements || [])
    .filter((s) => s.groupId === group?.id)
    .forEach((s) => {
      const amt = s.amountINR ?? s.amount ?? 0;
      netBalances[s.payerMemberId] = (netBalances[s.payerMemberId] || 0) + amt;
      netBalances[s.payeeMemberId] = (netBalances[s.payeeMemberId] || 0) - amt;
    });

  const balances: MemberBalance[] = members.map((m) => ({
    memberId: m.id,
    memberName: m.name,
    avatarUrl: m.avatarUrl,
    netBalanceINR: Math.round(netBalances[m.id] || 0),
  }));

  // Calculate simplified pairwise debts
  const debtors = balances.filter((b) => b.netBalanceINR < -1).map((b) => ({ ...b }));
  const creditors = balances.filter((b) => b.netBalanceINR > 1).map((b) => ({ ...b }));

  const pairwiseDebts: PairwiseDebt[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const owe = Math.abs(debtor.netBalanceINR);
    const get = creditor.netBalanceINR;
    const amount = Math.min(owe, get);

    if (amount > 1) {
      pairwiseDebts.push({
        id: `debt_${debtor.memberId}_${creditor.memberId}_${Date.now()}`,
        payerId: debtor.memberId,
        payerName: debtor.memberName,
        payerAvatarUrl: debtor.avatarUrl,
        payeeId: creditor.memberId,
        payeeName: creditor.memberName,
        payeeAvatarUrl: creditor.avatarUrl,
        amountINR: Math.round(amount),
      });
    }

    debtor.netBalanceINR += amount;
    creditor.netBalanceINR -= amount;

    if (Math.abs(debtor.netBalanceINR) < 1) dIdx++;
    if (Math.abs(creditor.netBalanceINR) < 1) cIdx++;
  }

  return { balances, pairwiseDebts };
}

/**
 * True, direct bilateral balance between every pair of members who actually
 * transacted — as opposed to calculateGroupBalances()'s pairwiseDebts, which is a
 * minimized settlement *suggestion* that can route a payment between two people who
 * never shared an expense. Mirrors the backend's `ExpenseCalculationService
 * .calculateRelationshipBalances()` exactly (docs/EXPENSES_API_SPEC.md §5.2.1): for
 * every unordered pair, net owed[A][B] against owed[B][A] and emit one entry only when
 * the net exceeds ±0.01 — a settled or never-transacted pair gets no entry at all.
 */
export function calculateRelationshipBalances(
  group: ExpenseGroup,
  expenses: Expense[],
  settlements: Settlement[],
): RelationshipBalance[] {
  const members = Array.isArray(group?.members) ? group.members : [];
  const owed: Record<string, Record<string, number>> = {};

  const addOwed = (fromId: string, toId: string, amount: number) => {
    if (!owed[fromId]) owed[fromId] = {};
    owed[fromId][toId] = (owed[fromId][toId] || 0) + amount;
  };

  (expenses || [])
    .filter((e) => e.groupId === group?.id)
    .forEach((e) => {
      (e.shares || []).forEach((share) => {
        if (share.memberId !== e.paidByMemberId) {
          addOwed(share.memberId, e.paidByMemberId, share.amount);
        }
      });
    });

  (settlements || [])
    .filter((s) => s.groupId === group?.id)
    .forEach((s) => {
      const amt = s.amountINR ?? s.amount ?? 0;
      addOwed(s.payerMemberId, s.payeeMemberId, -amt);
    });

  const relationships: RelationshipBalance[] = [];
  members.forEach((a, i) => {
    members.slice(i + 1).forEach((b) => {
      const aOwesB = owed[a.id]?.[b.id] || 0;
      const bOwesA = owed[b.id]?.[a.id] || 0;
      const net = aOwesB - bOwesA;

      if (net > 0.01) {
        relationships.push({
          id: `rel_${a.id}_${b.id}`,
          payerId: a.id,
          payerName: a.name,
          payerAvatarUrl: a.avatarUrl,
          payeeId: b.id,
          payeeName: b.name,
          payeeAvatarUrl: b.avatarUrl,
          amountINR: Math.round(net),
        });
      } else if (net < -0.01) {
        relationships.push({
          id: `rel_${b.id}_${a.id}`,
          payerId: b.id,
          payerName: b.name,
          payerAvatarUrl: b.avatarUrl,
          payeeId: a.id,
          payeeName: a.name,
          payeeAvatarUrl: a.avatarUrl,
          amountINR: Math.round(-net),
        });
      }
    });
  });

  return relationships;
}

export interface ExpenseDateGroup {
  dateKey: string;
  label: string;
  expenses: Expense[];
}

function formatExpenseDateLabel(dateKey: string): string {
  const todayKey = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().split('T')[0];

  if (dateKey === todayKey) return t('expenses.date_today');
  if (dateKey === yesterdayKey) return t('expenses.date_yesterday');

  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Buckets expenses by calendar day (most recent day first) so the UI can render a date
 * header per bucket — "Today" / "Yesterday" / "12 Aug 2026" — instead of a flat list.
 */
export function groupExpensesByDate(expenses: Expense[]): ExpenseDateGroup[] {
  const sorted = [...expenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const groups: ExpenseDateGroup[] = [];

  for (const expense of sorted) {
    const dateKey = expense.date || 'unknown';
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dateKey === dateKey) {
      lastGroup.expenses.push(expense);
    } else {
      groups.push({ dateKey, label: formatExpenseDateLabel(dateKey), expenses: [expense] });
    }
  }

  return groups;
}

export async function getGroupById(
  groupId: string,
  token?: string | null,
): Promise<ExpenseGroup | undefined> {
  if (token) {
    try {
      const remote = await getExpenseGroup(groupId, token);
      if (remote) {
        const groups = await loadGroups();
        await saveGroups([remote, ...groups.filter((g) => g.id !== remote.id)]);
        return remote;
      }
    } catch {
      // Fall through to local
    }
  }
  const groups = await loadGroups();
  return groups.find((g) => g.id === groupId);
}

/**
 * Checks whether a phone number belongs to a registered user before it's attached to a
 * new/existing group member, so the UI can show a verified badge + prefilled name
 * instead of blindly sending an unverified phone number to the backend.
 */
export async function verifyMemberByPhone(
  phone: string,
  token: string,
): Promise<MemberLookupResult | null> {
  return lookupMemberByPhone(phone, token);
}

export async function createGroup(
  name: string,
  emoji: string,
  memberInputs: (string | CreateGroupMemberInput)[],
  token?: string | null,
  currentUserId?: string | null,
  currentUserName?: string | null,
): Promise<{ group: ExpenseGroup; offline: boolean }> {
  const normalizedMembers: CreateGroupMemberInput[] = memberInputs.map((item) => {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      const isDigits = /^\+?[0-9]{10,13}$/.test(trimmed.replace(/[\s-]+/g, ''));
      if (isDigits) {
        const cleanDigits = trimmed.replace(/[\s-]+/g, '');
        const cleanPhone = cleanDigits.startsWith('+') ? cleanDigits : `+91${cleanDigits}`;
        return { name: cleanPhone, phone: cleanPhone };
      }
      return { name: trimmed };
    }
    const cleanPhone = item.phone?.trim()
      ? (item.phone.trim().startsWith('+')
          ? item.phone.trim().replace(/[\s-]+/g, '')
          : `+91${item.phone.trim().replace(/[\s-]+/g, '')}`)
      : undefined;
    return {
      name: item.name.trim(),
      phone: cleanPhone,
      userId: item.userId,
    };
  });

  const otherMembers = normalizedMembers.filter(
    (m) =>
      !m.name.toLowerCase().includes('(you)') &&
      !(currentUserName && m.name.toLowerCase() === currentUserName.toLowerCase()),
  );

  const memberPayload: CreateGroupMemberInput[] = otherMembers.map((m) => ({
    name: m.name,
    phone: m.phone,
    userId: m.userId,
  }));

  let offline = !token;

  if (token) {
    try {
      const created = await createExpenseGroup(
        {
          name,
          emoji: emoji || 'users',
          category: 'General',
          defaultCurrency: 'INR',
          members: memberPayload,
        },
        token,
      );
      if (created) {
        const groups = await loadGroups();
        await saveGroups([created, ...groups.filter((g) => g.id !== created.id)]);
        return { group: created, offline: false };
      }
    } catch (err) {
      if (isNetworkError(err)) offline = true;
      // Fall through to local fallback either way — never lose the user's input
    }
  }

  const firstInput = memberInputs[0];
  const myName = currentUserName
    ? `${currentUserName} (You)`
    : firstInput
    ? (typeof firstInput === 'string' ? firstInput : firstInput.name)
    : 'You (You)';

  const newMembers: GroupMember[] = [
    {
      id: currentUserId || `usr_me_${Date.now()}`,
      userId: currentUserId || undefined,
      name: myName,
      isOwner: true,
    },
    ...otherMembers.map((m, i) => ({
      id: `usr_${Date.now()}_${i + 1}`,
      userId: m.userId || undefined,
      name: m.name,
      phone: m.phone,
      isOwner: false,
    })),
  ];

  const newGroup: ExpenseGroup = {
    id: `grp_${Date.now()}`,
    name,
    emoji: emoji || 'users',
    category: 'General',
    defaultCurrency: 'INR',
    members: newMembers,
    memberCount: newMembers.length,
    expenseCount: 0,
    userNetBalanceINR: 0,
    ownerUserId: currentUserId || undefined,
    createdAt: new Date().toISOString().split('T')[0],
  };

  const groups = await loadGroups();
  const updated = [newGroup, ...groups];
  await saveGroups(updated);
  return { group: newGroup, offline };
}

const CURRENCY_RATES: Record<Currency, number> = {
  INR: 1,
  USD: 83.5,
  EUR: 90.2,
  AED: 22.7,
  GBP: 105.8,
};

export async function addExpenseToGroup(
  groupId: string,
  expenseData: {
    title: string;
    amount: number;
    currency: Currency;
    baseAmountINR?: number;
    payerId: string;
    splitMode: 'equal' | 'percentage' | 'shares';
    splits: Record<string, number>;
    category: string;
    date: string;
    notes?: string;
    receiptUri?: string;
  },
  token?: string | null,
): Promise<{ expense: Expense; offline: boolean }> {
  const rate = CURRENCY_RATES[expenseData.currency] || 1;
  const baseINR = expenseData.baseAmountINR ?? Math.round(expenseData.amount * rate);

  // `err.status === 0` is this codebase's convention (see `apiFetch`/`parseAuthError`)
  // for "fetch itself failed" — offline, DNS failure, server unreachable — as opposed to
  // a real HTTP error status from a reachable server.
  let offline = !token;

  if (token) {
    try {
      const created = await createGroupExpense(
        groupId,
        {
          title: expenseData.title,
          amount: expenseData.amount,
          currency: expenseData.currency,
          payerId: expenseData.payerId,
          splitMode: expenseData.splitMode,
          category: expenseData.category,
          date: expenseData.date,
          notes: expenseData.notes,
          receiptUri: expenseData.receiptUri,
          splits: expenseData.splits,
        },
        token,
      );
      if (created) {
        const expenses = await loadExpenses();
        await saveExpenses([created, ...expenses.filter((e) => e.id !== created.id)]);
        return { expense: created, offline: false };
      }
    } catch (err) {
      if (isNetworkError(err)) {
        offline = true;
      }
      // Fall through to local fallback either way — never lose the user's input
    }
  }

  const expenses = await loadExpenses();
  const splitType: SplitType =
    expenseData.splitMode === 'percentage'
      ? 'PERCENTAGE'
      : expenseData.splitMode === 'shares'
      ? 'SHARES'
      : 'EQUAL';

  let shares: SplitShare[] = [];
  if (expenseData.splitMode === 'percentage') {
    shares = Object.entries(expenseData.splits).map(([memId, pct]) => ({
      memberId: memId,
      amount: Math.round((baseINR * pct) / 100),
      percentage: pct,
    }));
  } else if (expenseData.splitMode === 'shares') {
    const totalWeight = Object.values(expenseData.splits).reduce((a, b) => a + b, 0) || 1;
    shares = Object.entries(expenseData.splits).map(([memId, weight]) => ({
      memberId: memId,
      amount: Math.round((baseINR * weight) / totalWeight),
    }));
  } else {
    const memberIds = Object.keys(expenseData.splits);
    const equalAmounts = computeEqualSplitAmounts(baseINR, memberIds);
    shares = memberIds.map((memId) => ({
      memberId: memId,
      amount: equalAmounts[memId],
    }));
  }

  const newExp: Expense = {
    id: `exp_${Date.now()}`,
    groupId,
    title: expenseData.title,
    amount: expenseData.amount,
    currency: expenseData.currency,
    baseAmountINR: baseINR,
    exchangeRate: rate,
    category: (expenseData.category.toLowerCase() as ExpenseCategory) || 'food',
    paidByMemberId: expenseData.payerId,
    splitType,
    shares,
    date: expenseData.date || new Date().toISOString().split('T')[0],
    notes: expenseData.notes,
    receiptUri: expenseData.receiptUri,
  };

  const updated = [newExp, ...expenses];
  await saveExpenses(updated);
  return { expense: newExp, offline };
}

export async function deleteExpenseFromGroup(
  groupId: string,
  expenseId: string,
  token?: string | null,
): Promise<{ offline: boolean }> {
  let offline = !token;
  if (token) {
    try {
      await deleteGroupExpense(groupId, expenseId, token);
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
      // Not a network error means the server was reached and rejected the delete
      // (e.g. a precondition failure) — still remove it locally either way, since the
      // caller already confirmed this delete via its own UI.
    }
  }
  const all = await loadExpenses();
  const updated = all.filter((e) => e.id !== expenseId);
  await saveExpenses(updated);
  return { offline };
}

export async function deleteGroup(groupId: string, token?: string | null): Promise<{ offline: boolean }> {
  let offline = !token;
  if (token) {
    try {
      await deleteExpenseGroup(groupId, token);
      offline = false;
    } catch (err) {
      offline = isNetworkError(err);
    }
  }
  const all = await loadGroups();
  await saveGroups(all.filter((g) => g.id !== groupId));
  const exps = await loadExpenses();
  await saveExpenses(exps.filter((e) => e.groupId !== groupId));
  const sets = await loadSettlements();
  await saveSettlements(sets.filter((s) => s.groupId !== groupId));
  return { offline };
}

export async function settlePairwiseDebt(
  groupId: string,
  payerId: string,
  payeeId: string,
  amountOrMethod?: number | 'upi' | 'cash' | 'bank_transfer',
  methodOrToken?: 'upi' | 'cash' | 'bank_transfer' | string | null,
  token?: string | null,
): Promise<{ settlement: Settlement; offline: boolean }> {
  let specifiedAmount = typeof amountOrMethod === 'number' ? amountOrMethod : 0;
  let method: 'upi' | 'cash' | 'bank_transfer' =
    typeof amountOrMethod === 'string'
      ? amountOrMethod
      : typeof methodOrToken === 'string' &&
        ['upi', 'cash', 'bank_transfer'].includes(methodOrToken)
      ? (methodOrToken as 'upi' | 'cash' | 'bank_transfer')
      : 'upi';
  let authToken: string | null =
    typeof methodOrToken === 'string' &&
    !['upi', 'cash', 'bank_transfer'].includes(methodOrToken)
      ? methodOrToken
      : token ?? null;

  if (specifiedAmount <= 0) {
    const groups = await loadGroups();
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      const expenses = await loadExpenses(groupId);
      const settlements = await loadSettlements(groupId);
      const { pairwiseDebts } = calculateGroupBalances(group, expenses, settlements);
      const debt = pairwiseDebts.find((d) => d.payerId === payerId && d.payeeId === payeeId);
      if (debt) specifiedAmount = debt.amountINR;
    }
  }

  const finalAmount = specifiedAmount > 0 ? specifiedAmount : 1000;
  let offline = !authToken;

  if (authToken) {
    try {
      const remote = await recordSettlement(
        groupId,
        {
          payerMemberId: payerId,
          payeeMemberId: payeeId,
          amount: finalAmount,
          currency: 'INR',
          method: method === 'upi' ? 'UPI' : method === 'cash' ? 'CASH' : 'BANK_TRANSFER',
          date: new Date().toISOString().split('T')[0],
        },
        authToken,
      );
      if (remote) {
        const settlements = await loadSettlements();
        await saveSettlements([remote, ...settlements.filter((s) => s.id !== remote.id)]);
        return { settlement: remote, offline: false };
      }
    } catch (err) {
      if (isNetworkError(err)) offline = true;
      // Fall through to local fallback either way — never lose the user's input
    }
  }
  const settlements = await loadSettlements();

  const newSet: Settlement = {
    id: `set_${Date.now()}`,
    groupId,
    payerMemberId: payerId,
    payeeMemberId: payeeId,
    amount: finalAmount,
    currency: 'INR',
    amountINR: finalAmount,
    method: method === 'upi' ? 'UPI' : method === 'cash' ? 'CASH' : 'BANK_TRANSFER',
    date: new Date().toISOString().split('T')[0],
  };

  const updated = [newSet, ...settlements];
  await saveSettlements(updated);
  return { settlement: newSet, offline };
}

export async function getGroupSyncDetails(groupId: string, token?: string | null) {
  if (token) {
    try {
      const syncRes = await getGroupSync(groupId, token);
      if (syncRes && syncRes.group) {
        if (syncRes.expenses) await saveExpenses(syncRes.expenses);
        if (syncRes.settlements) await saveSettlements(syncRes.settlements);
        return {
          group: syncRes.group,
          expenses: syncRes.expenses || [],
          settlements: syncRes.settlements || [],
          balances: syncRes.balances || [],
          pairwiseDebts: syncRes.pairwiseDebts || [],
          relationshipBalances:
            syncRes.relationshipBalances ||
            calculateRelationshipBalances(syncRes.group, syncRes.expenses || [], syncRes.settlements || []),
          categoryBreakdown: syncRes.categoryBreakdown || {},
          totalSpendINR: syncRes.totalSpendINR,
          userNetBalanceINR: syncRes.userNetBalanceINR,
        };
      }
    } catch {
      // Fallback: try individual endpoints
      try {
        const [remoteGroup, remoteExpenses, remoteSettlements] = await Promise.all([
          getExpenseGroup(groupId, token).catch(() => null),
          listGroupExpenses(groupId, token).catch(() => null),
          listGroupSettlements(groupId, token).catch(() => null),
        ]);
        if (remoteGroup) {
          const expsList: Expense[] = Array.isArray(remoteExpenses)
            ? remoteExpenses
            : remoteExpenses && 'content' in remoteExpenses
            ? remoteExpenses.content
            : [];
          const setsList: Settlement[] = Array.isArray(remoteSettlements) ? remoteSettlements : [];
          const { balances, pairwiseDebts } = calculateGroupBalances(remoteGroup, expsList, setsList);
          const relationshipBalances = calculateRelationshipBalances(remoteGroup, expsList, setsList);
          return {
            group: remoteGroup,
            expenses: expsList,
            settlements: setsList,
            balances,
            pairwiseDebts,
            relationshipBalances,
            categoryBreakdown: {},
          };
        }
      } catch {
        // Fall through to local computation
      }
    }
  }

  const group = await getGroupById(groupId, token);
  if (!group) return null;
  const expenses = await loadExpenses(groupId, token);
  const settlements = await loadSettlements(groupId, token);
  const { balances, pairwiseDebts } = calculateGroupBalances(group, expenses, settlements);
  const relationshipBalances = calculateRelationshipBalances(group, expenses, settlements);
  return { group, expenses, settlements, balances, pairwiseDebts, relationshipBalances };
}

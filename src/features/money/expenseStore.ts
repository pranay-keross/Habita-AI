import { getItem, setItem } from '../../utils/storage';
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
  recordSettlement,
} from './expenses/api';
import type {
  Currency,
  Expense,
  ExpenseCategory,
  ExpenseGroup,
  ExpenseSummaryStats,
  GroupMember,
  MemberBalance,
  PairwiseDebt,
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
    avatar: m.avatar,
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
        payerAvatar: debtor.avatar,
        payeeId: creditor.memberId,
        payeeName: creditor.memberName,
        payeeAvatar: creditor.avatar,
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

export async function createGroup(
  name: string,
  emoji: string,
  memberNames: string[],
  token?: string | null,
  currentUserId?: string | null,
  currentUserName?: string | null,
): Promise<ExpenseGroup> {
  const otherMemberNames = memberNames.filter(
    (n) =>
      !n.toLowerCase().includes('(you)') &&
      !(currentUserName && n.toLowerCase() === currentUserName.toLowerCase()),
  );
  const memberPayload = otherMemberNames.map((n) => ({ name: n }));

  if (token) {
    try {
      const created = await createExpenseGroup(
        {
          name,
          emoji: emoji || '👥',
          category: 'General',
          defaultCurrency: 'INR',
          members: memberPayload,
        },
        token,
      );
      if (created) {
        const groups = await loadGroups();
        await saveGroups([created, ...groups.filter((g) => g.id !== created.id)]);
        return created;
      }
    } catch {
      // Fall through to local fallback
    }
  }

  const myName = currentUserName ? `${currentUserName} (You)` : memberNames[0] || 'You (You)';
  const newMembers: GroupMember[] = [
    {
      id: currentUserId || `usr_me_${Date.now()}`,
      userId: currentUserId || undefined,
      name: myName,
      avatar: '👨‍💻',
      isOwner: true,
    },
    ...otherMemberNames.map((n, i) => ({
      id: `usr_${Date.now()}_${i + 1}`,
      name: n,
      avatar: '👤',
      isOwner: false,
    })),
  ];

  const newGroup: ExpenseGroup = {
    id: `grp_${Date.now()}`,
    name,
    emoji: emoji || '👥',
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
  return newGroup;
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
): Promise<Expense> {
  const rate = CURRENCY_RATES[expenseData.currency] || 1;
  const baseINR = expenseData.baseAmountINR ?? Math.round(expenseData.amount * rate);

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
        return created;
      }
    } catch {
      // Fall through to local fallback
    }
  }

  const expenses = await loadExpenses();
  const splitType: SplitType =
    expenseData.splitMode === 'percentage'
      ? 'PERCENTAGE'
      : expenseData.splitMode === 'shares'
      ? 'SHARES'
      : 'EQUAL';

  const shares: SplitShare[] = Object.entries(expenseData.splits).map(([memId, amt]) => ({
    memberId: memId,
    amount: amt,
  }));

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
  return newExp;
}

export async function deleteExpenseFromGroup(
  groupId: string,
  expenseId: string,
  token?: string | null,
): Promise<void> {
  if (token) {
    try {
      await deleteGroupExpense(groupId, expenseId, token);
    } catch {
      // ignore
    }
  }
  const all = await loadExpenses();
  const updated = all.filter((e) => e.id !== expenseId);
  await saveExpenses(updated);
}

export async function deleteGroup(groupId: string, token?: string | null): Promise<void> {
  if (token) {
    try {
      await deleteExpenseGroup(groupId, token);
    } catch {
      // ignore
    }
  }
  const all = await loadGroups();
  await saveGroups(all.filter((g) => g.id !== groupId));
  const exps = await loadExpenses();
  await saveExpenses(exps.filter((e) => e.groupId !== groupId));
  const sets = await loadSettlements();
  await saveSettlements(sets.filter((s) => s.groupId !== groupId));
}

export async function settlePairwiseDebt(
  groupId: string,
  payerId: string,
  payeeId: string,
  amountOrMethod?: number | 'upi' | 'cash' | 'bank_transfer',
  methodOrToken?: 'upi' | 'cash' | 'bank_transfer' | string | null,
  token?: string | null,
): Promise<Settlement> {
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
        return remote;
      }
    } catch {
      // Fall through to local fallback
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
  return newSet;
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
          return {
            group: remoteGroup,
            expenses: expsList,
            settlements: setsList,
            balances,
            pairwiseDebts,
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
  return { group, expenses, settlements, balances, pairwiseDebts };
}

import { getItem, setItem } from '../../utils/storage';
import type {
  Currency,
  Expense,
  ExpenseCategory,
  ExpenseGroup,
  GroupMember,
  MemberBalance,
  PairwiseDebt,
  Settlement,
  SplitShare,
  SplitType,
} from './types';

const GROUPS_STORAGE_KEY = 'habita.expense_groups';
const EXPENSES_STORAGE_KEY = 'habita.expenses';
const SETTLEMENTS_STORAGE_KEY = 'habita.settlements';

// Default initial sample data
const INITIAL_MEMBERS: GroupMember[] = [
  { id: 'usr_me', name: 'Animesh (You)', avatar: '👨‍💻', isOwner: true },
  { id: 'usr_2', name: 'Rahul Sharma', avatar: '👨‍🦱' },
  { id: 'usr_3', name: 'Priya Patel', avatar: '👩‍🦰' },
  { id: 'usr_4', name: 'Rohan Gupta', avatar: '🧔' },
];

const INITIAL_GROUPS: ExpenseGroup[] = [
  {
    id: 'grp_1',
    name: 'Home Rent & Bills',
    emoji: '🏠',
    category: 'Rent & Living',
    defaultCurrency: 'INR',
    members: [INITIAL_MEMBERS[0], INITIAL_MEMBERS[1], INITIAL_MEMBERS[2]],
    createdAt: '2026-08-01',
  },
  {
    id: 'grp_2',
    name: 'Weekend Goa Trip',
    emoji: '🏖️',
    category: 'Travel & Fun',
    defaultCurrency: 'INR',
    members: INITIAL_MEMBERS,
    createdAt: '2026-08-05',
  },
  {
    id: 'grp_3',
    name: 'Office Lunch Crew',
    emoji: '🥗',
    category: 'Food & Dining',
    defaultCurrency: 'INR',
    members: [INITIAL_MEMBERS[0], INITIAL_MEMBERS[1], INITIAL_MEMBERS[3]],
    createdAt: '2026-08-10',
  },
];

const INITIAL_EXPENSES: Expense[] = [
  {
    id: 'exp_1',
    groupId: 'grp_1',
    title: 'Monthly Rent Payment',
    amount: 36000,
    currency: 'INR',
    baseAmountINR: 36000,
    category: 'rent',
    paidByMemberId: 'usr_me',
    splitType: 'EQUAL',
    shares: [
      { memberId: 'usr_me', amount: 12000 },
      { memberId: 'usr_2', amount: 12000 },
      { memberId: 'usr_3', amount: 12000 },
    ],
    date: '2026-08-01',
    notes: 'Paid via NetBanking for August',
  },
  {
    id: 'exp_2',
    groupId: 'grp_1',
    title: 'Electricity & Wifi Bill',
    amount: 4500,
    currency: 'INR',
    baseAmountINR: 4500,
    category: 'bills',
    paidByMemberId: 'usr_2',
    splitType: 'EQUAL',
    shares: [
      { memberId: 'usr_me', amount: 1500 },
      { memberId: 'usr_2', amount: 1500 },
      { memberId: 'usr_3', amount: 1500 },
    ],
    date: '2026-08-05',
  },
  {
    id: 'exp_3',
    groupId: 'grp_2',
    title: 'Beach Resort Booking',
    amount: 24000,
    currency: 'INR',
    baseAmountINR: 24000,
    category: 'travel',
    paidByMemberId: 'usr_me',
    splitType: 'EQUAL',
    shares: [
      { memberId: 'usr_me', amount: 6000 },
      { memberId: 'usr_2', amount: 6000 },
      { memberId: 'usr_3', amount: 6000 },
      { memberId: 'usr_4', amount: 6000 },
    ],
    date: '2026-08-06',
  },
  {
    id: 'exp_4',
    groupId: 'grp_2',
    title: 'Seafood Dinner & Drinks',
    amount: 6400,
    currency: 'INR',
    baseAmountINR: 6400,
    category: 'food',
    paidByMemberId: 'usr_3',
    splitType: 'PERCENTAGE',
    shares: [
      { memberId: 'usr_me', amount: 1600, percentage: 25 },
      { memberId: 'usr_2', amount: 1600, percentage: 25 },
      { memberId: 'usr_3', amount: 1600, percentage: 25 },
      { memberId: 'usr_4', amount: 1600, percentage: 25 },
    ],
    date: '2026-08-07',
  },
];

const INITIAL_SETTLEMENTS: Settlement[] = [
  {
    id: 'set_1',
    groupId: 'grp_1',
    payerMemberId: 'usr_2',
    payeeMemberId: 'usr_me',
    amount: 5000,
    currency: 'INR',
    amountINR: 5000,
    method: 'UPI',
    date: '2026-08-03',
    notes: 'Partial payment towards August rent',
  },
];

export async function loadGroups(): Promise<ExpenseGroup[]> {
  const data = await getItem<ExpenseGroup[]>(GROUPS_STORAGE_KEY, INITIAL_GROUPS);
  if (!data || data.length === 0) {
    await saveGroups(INITIAL_GROUPS);
    return INITIAL_GROUPS;
  }
  return data;
}

export async function saveGroups(groups: ExpenseGroup[]): Promise<void> {
  await setItem(GROUPS_STORAGE_KEY, groups);
}

export async function loadExpenses(groupId?: string): Promise<Expense[]> {
  const data = await getItem<Expense[]>(EXPENSES_STORAGE_KEY, INITIAL_EXPENSES);
  const list = data && data.length > 0 ? data : INITIAL_EXPENSES;
  if (!data || data.length === 0) {
    await saveExpenses(INITIAL_EXPENSES);
  }
  return groupId ? list.filter((e) => e.groupId === groupId) : list;
}

export async function saveExpenses(expenses: Expense[]): Promise<void> {
  await setItem(EXPENSES_STORAGE_KEY, expenses);
}

export async function loadSettlements(groupId?: string): Promise<Settlement[]> {
  const data = await getItem<Settlement[]>(SETTLEMENTS_STORAGE_KEY, INITIAL_SETTLEMENTS);
  const list = data && data.length > 0 ? data : INITIAL_SETTLEMENTS;
  if (!data || data.length === 0) {
    await saveSettlements(INITIAL_SETTLEMENTS);
  }
  return groupId ? list.filter((s) => s.groupId === groupId) : list;
}

export async function saveSettlements(settlements: Settlement[]): Promise<void> {
  await setItem(SETTLEMENTS_STORAGE_KEY, settlements);
}

// Calculate overall net balance for each member in a group
export function calculateGroupBalances(
  group: ExpenseGroup,
  expenses: Expense[],
  settlements: Settlement[],
): { balances: MemberBalance[]; pairwiseDebts: PairwiseDebt[] } {
  const netBalances: Record<string, number> = {};

  // Initialize
  group.members.forEach((m) => {
    netBalances[m.id] = 0;
  });

  // Account for expenses
  expenses
    .filter((e) => e.groupId === group.id)
    .forEach((e) => {
      // Paid amount adds to payer's net balance
      netBalances[e.paidByMemberId] = (netBalances[e.paidByMemberId] || 0) + e.baseAmountINR;

      // Deduct each share from the respective member's net balance
      e.shares.forEach((share) => {
        netBalances[share.memberId] = (netBalances[share.memberId] || 0) - share.amount;
      });
    });

  // Account for settlements
  settlements
    .filter((s) => s.groupId === group.id)
    .forEach((s) => {
      // Payer paid -> net balance increases
      netBalances[s.payerMemberId] = (netBalances[s.payerMemberId] || 0) + s.amountINR;
      // Payee received -> net balance decreases
      netBalances[s.payeeMemberId] = (netBalances[s.payeeMemberId] || 0) - s.amountINR;
    });

  const balances: MemberBalance[] = group.members.map((m) => ({
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

export async function getGroupById(groupId: string): Promise<ExpenseGroup | undefined> {
  const groups = await loadGroups();
  return groups.find((g) => g.id === groupId);
}

export async function createGroup(
  name: string,
  emoji: string,
  memberNames: string[],
): Promise<ExpenseGroup> {
  const groups = await loadGroups();
  const newMembers: GroupMember[] = memberNames.map((n, i) => ({
    id: i === 0 ? 'usr_me' : `usr_added_${Date.now()}_${i}`,
    name: n,
    avatar: i === 0 ? '👨‍💻' : '👤',
    isOwner: i === 0,
  }));

  const newGroup: ExpenseGroup = {
    id: `grp_${Date.now()}`,
    name,
    emoji: emoji || '👥',
    category: 'General',
    defaultCurrency: 'INR',
    members: newMembers,
    createdAt: new Date().toISOString().split('T')[0],
  };

  const updated = [newGroup, ...groups];
  await saveGroups(updated);
  return newGroup;
}

export async function addExpenseToGroup(
  groupId: string,
  expenseData: {
    title: string;
    amount: number;
    currency: Currency;
    payerId: string;
    splitMode: 'equal' | 'percentage' | 'shares';
    splits: Record<string, number>;
    category: string;
    date: string;
  },
): Promise<Expense> {
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
    baseAmountINR: expenseData.amount,
    category: (expenseData.category.toLowerCase() as ExpenseCategory) || 'food',
    paidByMemberId: expenseData.payerId,
    splitType,
    shares,
    date: expenseData.date || new Date().toISOString().split('T')[0],
  };

  const updated = [newExp, ...expenses];
  await saveExpenses(updated);
  return newExp;
}

export async function settlePairwiseDebt(
  groupId: string,
  payerId: string,
  payeeId: string,
  method: 'upi' | 'cash' | 'bank_transfer',
): Promise<Settlement> {
  const settlements = await loadSettlements();
  const groups = await loadGroups();
  const group = groups.find((g) => g.id === groupId);

  let amt = 0;
  if (group) {
    const expenses = await loadExpenses(groupId);
    const { pairwiseDebts } = calculateGroupBalances(group, expenses, settlements);
    const debt = pairwiseDebts.find((d) => d.payerId === payerId && d.payeeId === payeeId);
    if (debt) amt = debt.amountINR;
  }

  const newSet: Settlement = {
    id: `set_${Date.now()}`,
    groupId,
    payerMemberId: payerId,
    payeeMemberId: payeeId,
    amount: amt || 1000,
    currency: 'INR',
    amountINR: amt || 1000,
    method: method === 'upi' ? 'UPI' : method === 'cash' ? 'CASH' : 'BANK_TRANSFER',
    date: new Date().toISOString().split('T')[0],
  };

  const updated = [newSet, ...settlements];
  await saveSettlements(updated);
  return newSet;
}

export async function getGroupSyncDetails(groupId: string) {
  const group = await getGroupById(groupId);
  if (!group) return null;
  const expenses = await loadExpenses(groupId);
  const settlements = await loadSettlements(groupId);
  const { balances, pairwiseDebts } = calculateGroupBalances(group, expenses, settlements);
  return { group, expenses, settlements, balances, pairwiseDebts };
}


export type Currency = 'INR' | 'USD' | 'EUR' | 'AED' | 'GBP';

export type SplitType = 'EQUAL' | 'PERCENTAGE' | 'SHARES';

export type ExpenseCategory =
  | 'food'
  | 'travel'
  | 'rent'
  | 'bills'
  | 'groceries'
  | 'shopping'
  | 'entertainment';

export interface CurrencyRate {
  code: Currency;
  symbol: string;
  rateToINR: number;
}

export const CURRENCY_RATES: Record<Currency, CurrencyRate> = {
  INR: { code: 'INR', symbol: '₹', rateToINR: 1.0 },
  USD: { code: 'USD', symbol: '$', rateToINR: 83.5 },
  EUR: { code: 'EUR', symbol: '€', rateToINR: 90.5 },
  AED: { code: 'AED', symbol: 'AED ', rateToINR: 22.7 },
  GBP: { code: 'GBP', symbol: '£', rateToINR: 105.0 },
};

export interface GroupMember {
  id: string;
  name: string;
  avatar: string;
  phone?: string;
  userId?: string | null;
  isOwner?: boolean;
}

export interface SplitShare {
  memberId: string;
  amount: number;
  percentage?: number;
  shares?: number;
}

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  currency: Currency;
  baseAmountINR: number;
  exchangeRate?: number;
  category: ExpenseCategory;
  paidByMemberId: string;
  paidByName?: string;
  splitType: SplitType;
  shares: SplitShare[];
  date: string; // YYYY-MM-DD
  notes?: string;
  receiptUri?: string;
  createdAt?: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  payerMemberId: string;
  payerName?: string;
  payeeMemberId: string;
  payeeName?: string;
  amount: number;
  currency: Currency;
  amountINR: number;
  method: 'UPI' | 'CASH' | 'BANK_TRANSFER';
  date: string; // YYYY-MM-DD
  notes?: string;
  createdAt?: string;
}

export interface ExpenseGroup {
  id: string;
  name: string;
  emoji: string;
  category: string;
  defaultCurrency: Currency;
  members: GroupMember[];
  createdAt: string;
  ownerUserId?: string;
  memberCount?: number;
  expenseCount?: number;
  userNetBalanceINR?: number;
  status?: 'YOU_GET_BACK' | 'YOU_OWE' | 'SETTLED_UP';
}

export interface MemberBalance {
  memberId: string;
  memberName: string;
  avatar: string;
  netBalanceINR: number; // Positive = gets back, Negative = owes
}

export interface PairwiseDebt {
  id: string;
  payerId: string;
  payerName: string;
  payerAvatar: string;
  payeeId: string;
  payeeName: string;
  payeeAvatar: string;
  amountINR: number;
}

export interface ExpenseSummaryStats {
  totalSpentINR: number;
  youAreOwedINR: number;
  youOweINR: number;
}

export interface ExpenseGroupListResponse {
  summary: ExpenseSummaryStats;
  groups: ExpenseGroup[];
}

export interface CreateExpenseGroupRequest {
  name: string;
  emoji?: string;
  category?: string;
  defaultCurrency?: Currency;
  members?: { name: string; avatar?: string; phone?: string }[];
}

export interface UpdateExpenseGroupRequest {
  name?: string;
  emoji?: string;
  category?: string;
  defaultCurrency?: Currency;
}

export interface AddGroupMemberRequest {
  name: string;
  avatar?: string;
  phone?: string;
  userId?: string | null;
}

export interface CreateExpenseRequest {
  title: string;
  amount: number;
  currency: Currency;
  payerId: string;
  splitMode: SplitType | 'equal' | 'percentage' | 'shares';
  category: string;
  date: string;
  notes?: string;
  receiptUri?: string;
  splits?: Record<string, number>;
}

export interface RecordSettlementRequest {
  payerMemberId: string;
  payeeMemberId: string;
  amount: number;
  currency: Currency;
  method: 'UPI' | 'CASH' | 'BANK_TRANSFER';
  date: string;
  notes?: string;
}

export interface GroupSyncResponse {
  group: ExpenseGroup;
  totalSpendINR?: number;
  userNetBalanceINR?: number;
  expenses: Expense[];
  settlements: Settlement[];
  balances: MemberBalance[];
  pairwiseDebts: PairwiseDebt[];
  categoryBreakdown: Record<string, number>;
}

export interface SpendSummaryResponse {
  rolling30DaysSpendINR: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
}

export interface PaginatedExpensesResponse {
  content: Expense[];
  totalElements: number;
  totalPages: number;
}


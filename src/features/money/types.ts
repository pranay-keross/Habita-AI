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
  avatarUrl?: string | null;
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
  // A lucide icon key (e.g. "house"), not an emoji character — see groupIcons.ts.
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
  avatarUrl?: string | null;
  netBalanceINR: number; // Positive = gets back, Negative = owes
}

export interface PairwiseDebt {
  id: string;
  payerId: string;
  payerName: string;
  payerAvatarUrl?: string | null;
  payeeId: string;
  payeeName: string;
  payeeAvatarUrl?: string | null;
  amountINR: number;
}

// Same shape as PairwiseDebt (the backend's ExpenseCalculationService literally reuses
// its DTO for both — docs/EXPENSES_API_SPEC.md §5.2.1), but a different meaning:
// PairwiseDebt is a *minimized settlement suggestion* that can route a payment between
// two people who never shared an expense; RelationshipBalance is the *true, direct*
// bilateral balance between a pair who actually transacted, opposite directions netted.
// Only non-zero relationships are included — a settled or never-transacted pair simply
// has no entry. Use this for "Owed by you"/"Owed to you"; reserve PairwiseDebt for the
// "Settle Up" suggestion.
export type RelationshipBalance = PairwiseDebt;

export interface ExpenseSummaryStats {
  totalSpentINR: number;
  youAreOwedINR: number;
  youOweINR: number;
}

export interface ExpenseGroupListResponse {
  summary: ExpenseSummaryStats;
  groups: ExpenseGroup[];
  // Pagination metadata (contract addition, 2026-08-29 — see docs/EXPENSES_API_SPEC.md
  // §4.1). Optional so a backend that hasn't shipped pagination yet still validates —
  // the client treats a response missing these as one big unpaginated page.
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
}

export interface MemberLookupResult {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  phone: string;
}

export interface CreateGroupMemberInput {
  name: string;
  phone?: string;
  userId?: string | null;
}

export interface CreateExpenseGroupRequest {
  name: string;
  emoji?: string;
  category?: string;
  defaultCurrency?: Currency;
  members?: CreateGroupMemberInput[];
}

export interface UpdateExpenseGroupRequest {
  name?: string;
  emoji?: string;
  category?: string;
  defaultCurrency?: Currency;
}

export interface AddGroupMemberRequest {
  name: string;
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
  // New field (2026-08-29, docs/EXPENSES_API_SPEC.md §4.5/§5.2.1) — optional so the
  // client keeps working against a backend that hasn't shipped it yet by computing it
  // locally instead (see calculateRelationshipBalances() in expenseStore.ts).
  relationshipBalances?: RelationshipBalance[];
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
  page?: number;
  size?: number;
}


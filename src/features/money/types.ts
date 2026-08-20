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
  category: ExpenseCategory;
  paidByMemberId: string;
  splitType: SplitType;
  shares: SplitShare[];
  date: string; // YYYY-MM-DD
  notes?: string;
  receiptUri?: string;
}

export interface Settlement {
  id: string;
  groupId: string;
  payerMemberId: string;
  payeeMemberId: string;
  amount: number;
  currency: Currency;
  amountINR: number;
  method: 'UPI' | 'CASH' | 'BANK_TRANSFER';
  date: string; // YYYY-MM-DD
  notes?: string;
}

export interface ExpenseGroup {
  id: string;
  name: string;
  emoji: string;
  category: string;
  defaultCurrency: Currency;
  members: GroupMember[];
  createdAt: string;
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

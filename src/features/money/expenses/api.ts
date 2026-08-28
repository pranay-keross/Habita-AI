import { apiFetch, ApiError } from '../../auth/api';
import type {
  AddGroupMemberRequest,
  CreateExpenseGroupRequest,
  CreateExpenseRequest,
  Expense,
  ExpenseGroup,
  ExpenseGroupListResponse,
  GroupMember,
  GroupSyncResponse,
  PaginatedExpensesResponse,
  RecordSettlementRequest,
  Settlement,
  SpendSummaryResponse,
  UpdateExpenseGroupRequest,
} from '../types';

/**
 * Habita AI — Expense Groups & Multi-Currency Splitting Backend API
 *
 * Implements the contract defined in:
 * - Saheli Backend — Auth, Profile & Family.postman_collection.json ("Expense Groups & Multi-Currency Splitting")
 * - Habita AI SRS Module 11 (§11 'Multi-Currency Expense Groups')
 * - docs/EXPENSES_API_SPEC.md
 */

/**
 * Retrieves all expense groups for the authenticated user along with
 * overall summary (totalSpentINR, youAreOwedINR, youOweINR).
 * GET /api/expense-groups
 */
export async function listExpenseGroups(token: string): Promise<ExpenseGroupListResponse> {
  return apiFetch<ExpenseGroupListResponse>('/expense-groups', {
    method: 'GET',
    token,
  });
}

/**
 * Creates a new expense group. The creator is automatically added as the owner and first member.
 * POST /api/expense-groups
 */
export async function createExpenseGroup(
  data: CreateExpenseGroupRequest,
  token: string,
): Promise<ExpenseGroup> {
  return apiFetch<ExpenseGroup>('/expense-groups', {
    method: 'POST',
    body: data,
    token,
  });
}

/**
 * Fetches details of a specific expense group including all member profiles.
 * GET /api/expense-groups/{groupId}
 */
export async function getExpenseGroup(groupId: string, token: string): Promise<ExpenseGroup> {
  return apiFetch<ExpenseGroup>(`/expense-groups/${groupId}`, {
    method: 'GET',
    token,
  });
}

/**
 * Updates group metadata (name, emoji, category, default currency).
 * PUT /api/expense-groups/{groupId}
 */
export async function updateExpenseGroup(
  groupId: string,
  data: UpdateExpenseGroupRequest,
  token: string,
): Promise<ExpenseGroup> {
  return apiFetch<ExpenseGroup>(`/expense-groups/${groupId}`, {
    method: 'PUT',
    body: data,
    token,
  });
}

/**
 * Soft-deletes an expense group.
 * DELETE /api/expense-groups/{groupId}
 */
export async function deleteExpenseGroup(groupId: string, token: string): Promise<void> {
  await apiFetch<void>(`/expense-groups/${groupId}`, {
    method: 'DELETE',
    token,
  });
}

/**
 * Adds a member to an existing group (either a registered user or an ad-hoc name).
 * POST /api/expense-groups/{groupId}/members
 */
export async function addExpenseGroupMember(
  groupId: string,
  data: AddGroupMemberRequest,
  token: string,
): Promise<GroupMember> {
  return apiFetch<GroupMember>(`/expense-groups/${groupId}/members`, {
    method: 'POST',
    body: data,
    token,
  });
}

/**
 * Removes a member from a group. Precondition: Member's net balance must be 0.00.
 * DELETE /api/expense-groups/{groupId}/members/{memberId}
 */
export async function removeExpenseGroupMember(
  groupId: string,
  memberId: string,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/expense-groups/${groupId}/members/${memberId}`, {
    method: 'DELETE',
    token,
  });
}

/**
 * List expenses for the group with optional pagination and category filtering.
 * GET /api/expense-groups/{groupId}/expenses?page=0&size=50
 */
export async function listGroupExpenses(
  groupId: string,
  token: string,
  options?: { page?: number; size?: number; category?: string },
): Promise<PaginatedExpensesResponse | Expense[]> {
  const page = options?.page ?? 0;
  const size = options?.size ?? 50;
  let path = `/expense-groups/${groupId}/expenses?page=${page}&size=${size}`;
  if (options?.category) {
    path += `&category=${encodeURIComponent(options.category)}`;
  }
  return apiFetch<PaginatedExpensesResponse | Expense[]>(path, {
    method: 'GET',
    token,
  });
}

/**
 * Adds an expense and itemizes splits across group members.
 * Supports EQUAL (with 1-paise rounding), PERCENTAGE (sums to 100%), and SHARES split modes,
 * plus multi-currency automatic conversion to base INR.
 * POST /api/expense-groups/{groupId}/expenses
 */
export async function createGroupExpense(
  groupId: string,
  data: CreateExpenseRequest,
  token: string,
): Promise<Expense> {
  return apiFetch<Expense>(`/expense-groups/${groupId}/expenses`, {
    method: 'POST',
    body: data,
    token,
  });
}

/**
 * Gets single expense details with full split itemization and payer metadata.
 * GET /api/expense-groups/{groupId}/expenses/{expenseId}
 */
export async function getGroupExpense(
  groupId: string,
  expenseId: string,
  token: string,
): Promise<Expense> {
  return apiFetch<Expense>(`/expense-groups/${groupId}/expenses/${expenseId}`, {
    method: 'GET',
    token,
  });
}

/**
 * Soft-deletes the expense, triggering recalculation of balances.
 * DELETE /api/expense-groups/{groupId}/expenses/{expenseId}
 */
export async function deleteGroupExpense(
  groupId: string,
  expenseId: string,
  token: string,
): Promise<void> {
  await apiFetch<void>(`/expense-groups/${groupId}/expenses/${expenseId}`, {
    method: 'DELETE',
    token,
  });
}

/**
 * Records a payment made between two members to settle debt (UPI, Cash, or Bank Transfer).
 * POST /api/expense-groups/{groupId}/settlements
 */
export async function recordSettlement(
  groupId: string,
  data: RecordSettlementRequest,
  token: string,
): Promise<Settlement> {
  return apiFetch<Settlement>(`/expense-groups/${groupId}/settlements`, {
    method: 'POST',
    body: data,
    token,
  });
}

/**
 * List all settlements recorded for the group.
 * GET /api/expense-groups/{groupId}/settlements
 */
export async function listGroupSettlements(
  groupId: string,
  token: string,
): Promise<Settlement[]> {
  return apiFetch<Settlement[]>(`/expense-groups/${groupId}/settlements`, {
    method: 'GET',
    token,
  });
}

/**
 * Single performant sync payload returning group metadata, active expenses, settlements,
 * computed balances, pairwise debts, and category spending analytics.
 * GET /api/expense-groups/{groupId}/sync
 */
export async function getGroupSync(
  groupId: string,
  token: string,
): Promise<GroupSyncResponse> {
  return apiFetch<GroupSyncResponse>(`/expense-groups/${groupId}/sync`, {
    method: 'GET',
    token,
  });
}

/**
 * Returns user's rolling 30-day spend total in INR (used by Dashboard spend tile).
 * GET /api/expenses/summary/30-day
 */
export async function getRolling30DaySpend(token: string): Promise<SpendSummaryResponse> {
  return apiFetch<SpendSummaryResponse>('/expenses/summary/30-day', {
    method: 'GET',
    token,
  });
}

export { ApiError };

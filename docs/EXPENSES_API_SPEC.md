# Habita AI — Expense Section Backend API Specification & Requirements

> **Target Audience:** Backend Developers & AI Agents building the Spring Boot / PostgreSQL backend for Habita AI.  
> **Module Reference:** SRS Module Group 4 (§11 "Multi-Currency Expense Groups") & API Ecosystem Summary (`/api/expense-groups`).  
> **Frontend Consumers:**  
> - `src/features/money/expenses/ExpenseGroupsScreen.tsx`  
> - `src/features/money/expenses/GroupDetailsScreen.tsx`  
> - `src/features/money/expenses/AddSplitExpenseScreen.tsx`  
> - `src/features/money/expenses/ExpenseDetailsSettleUpScreen.tsx`  
> - `src/features/money/expenseStore.ts`  
> - `src/features/money/types.ts`  
> - `src/app/dashboard.tsx` (30-day spend rollup)  
> - `src/features/money/voice_assistant/VoiceScreen.tsx` (Voice balance queries)

---

## 1. Executive Summary & Domain Scope

The Expense Section provides household and social expense management, dynamic multi-currency bill splitting, debt simplification, and settlement recording. 

### Core Business Capabilities:
1. **Multi-Currency Groups:** Create and manage expense groups with custom emoji icons, categories, and member lists with a default currency (INR, USD, EUR, AED, GBP).
2. **Dynamic Bill Splitting:** Support 3 split modes:
   - **EQUAL:** Divided evenly among group members (with 1-paise / cent rounding distribution).
   - **PERCENTAGE:** Exact percentage share per member (validated to strictly sum to 100%).
   - **SHARES:** Proportional weight multiplier (e.g. 1 share, 2 shares for couples/families).
3. **Multi-Currency Normalization:** Expenses can be entered in any supported currency and are converted to the base currency (INR) using live or configured exchange rates for consistent balance rollups.
4. **Automated Balance & Debt Minimization:** Real-time net balance calculations (`positive = gets back`, `negative = owes`) and pairwise debt simplification using a greedy bipartite settlement algorithm.
5. **Settlement Tracking:** Record debt payments via UPI, Cash, or Bank Transfer, automatically adjusting pairwise and group net balances.
6. **Soft-Delete Auditability:** Expenses and groups use soft deletes (`deleted_at`) to preserve historical balance audit trails.

---

## 2. Authentication & Authorization

- **Standard Header:** All requests require standard Bearer token authentication:
  ```http
  Authorization: Bearer <accessToken>
  ```
- **User Identity:** The authenticated caller's `userId` is extracted from the JWT claims (`sub` / `userId`).
- **Group Membership Gate:**
  - Reading a group, its expenses, balances, or settlements requires the authenticated user to be an active member of that group.
  - Adding an expense or recording a settlement requires active membership.
  - Deleting/Archiving a group requires the caller to be the group's `ownerUserId`.
  - Only the group owner can add or remove members. A member cannot be removed if their `netBalance` is non-zero.

---

## 3. Supported Enums & Data Types

### 3.1 Currency
```typescript
type Currency = 'INR' | 'USD' | 'EUR' | 'AED' | 'GBP';
```
Base currency for system calculation is **`INR`**. Reference exchange rates (configured in DB or fetched from FX service):
- `INR`: 1.0 (Base)
- `USD`: 83.5
- `EUR`: 90.5
- `AED`: 22.7
- `GBP`: 105.0

### 3.2 Split Type
```typescript
type SplitType = 'EQUAL' | 'PERCENTAGE' | 'SHARES';
```

### 3.3 Expense Category
```typescript
type ExpenseCategory =
  | 'food'
  | 'travel'
  | 'rent'
  | 'bills'
  | 'groceries'
  | 'shopping'
  | 'entertainment';
```

### 3.4 Settlement Method
```typescript
type SettlementMethod = 'UPI' | 'CASH' | 'BANK_TRANSFER';
```

---

## 4. REST API Endpoint Specifications

Base Path: `/api/expense-groups`

### 4.1 Groups API

#### `GET /api/expense-groups`
Retrieves all expense groups for the authenticated user, along with the user's net balance in each group and an overall summary.

- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
```json
{
  "summary": {
    "totalSpentINR": 70900.00,
    "youAreOwedINR": 33900.00,
    "youOweINR": 0.00
  },
  "groups": [
    {
      "id": "grp_1",
      "name": "Home Rent & Bills",
      "emoji": "🏠",
      "category": "Rent & Living",
      "defaultCurrency": "INR",
      "ownerUserId": "usr_me_123",
      "memberCount": 3,
      "expenseCount": 2,
      "userNetBalanceINR": 17500.00,
      "status": "YOU_GET_BACK", // "YOU_GET_BACK" | "YOU_OWE" | "SETTLED_UP"
      "createdAt": "2026-08-01T00:00:00Z"
    }
  ]
}
```

---

#### `POST /api/expense-groups`
Creates a new expense group. The creator is automatically added as the owner and first member.

- **Request Body:**
```json
{
  "name": "Weekend Goa Trip",
  "emoji": "🏖️",
  "category": "Travel & Fun",
  "defaultCurrency": "INR",
  "members": [
    { "name": "Rahul Sharma", "avatar": "👨‍🦱", "phone": "+919876543210" },
    { "name": "Priya Patel", "avatar": "👩‍🦰" }
  ]
}
```
- **Response (201 Created):**
```json
{
  "id": "grp_2",
  "name": "Weekend Goa Trip",
  "emoji": "🏖️",
  "category": "Travel & Fun",
  "defaultCurrency": "INR",
  "ownerUserId": "usr_me_123",
  "members": [
    { "id": "mem_1", "userId": "usr_me_123", "name": "Animesh", "avatar": "👨‍💻", "isOwner": true },
    { "id": "mem_2", "userId": null, "name": "Rahul Sharma", "avatar": "👨‍🦱", "isOwner": false },
    { "id": "mem_3", "userId": null, "name": "Priya Patel", "avatar": "👩‍🦰", "isOwner": false }
  ],
  "createdAt": "2026-08-05T10:00:00Z"
}
```

---

#### `GET /api/expense-groups/{groupId}`
Fetches details of a specific expense group including all member profiles.

- **Response (200 OK):**
```json
{
  "id": "grp_1",
  "name": "Home Rent & Bills",
  "emoji": "🏠",
  "category": "Rent & Living",
  "defaultCurrency": "INR",
  "ownerUserId": "usr_me_123",
  "members": [
    { "id": "mem_1", "userId": "usr_me_123", "name": "Animesh (You)", "avatar": "👨‍💻", "isOwner": true },
    { "id": "mem_2", "userId": "usr_2", "name": "Rahul Sharma", "avatar": "👨‍🦱", "isOwner": false },
    { "id": "mem_3", "userId": "usr_3", "name": "Priya Patel", "avatar": "👩‍🦰", "isOwner": false }
  ],
  "createdAt": "2026-08-01T00:00:00Z"
}
```

---

#### `PUT /api/expense-groups/{groupId}`
Updates group metadata (name, emoji, category, default currency).

- **Request Body:**
```json
{
  "name": "Goa Trip 2026",
  "emoji": "🌴",
  "category": "Vacation",
  "defaultCurrency": "INR"
}
```
- **Response (200 OK):** Updated group object.

---

#### `DELETE /api/expense-groups/{groupId}`
Soft-deletes an expense group. Allowed only if all balances are settled (or owner forces archive).

- **Response (204 No Content)**

---

### 4.2 Group Members API

#### `POST /api/expense-groups/{groupId}/members`
Adds a member to an existing group (either an existing registered user via phone/userId, or an ad-hoc member name).

- **Request Body:**
```json
{
  "name": "Rohan Gupta",
  "avatar": "🧔",
  "phone": "+919123456789",
  "userId": null
}
```
- **Response (201 Created):** `GroupMember` object.

---

#### `DELETE /api/expense-groups/{groupId}/members/{memberId}`
Removes a member from a group.
- **Precondition:** Member's net balance must be `0.00`. If net balance != 0, returns `400 Bad Request` (`"Cannot remove member with unsettled balance"`).
- **Response (204 No Content)**

---

### 4.3 Expenses API

#### `GET /api/expense-groups/{groupId}/expenses`
List expenses for the group with optional pagination.

- **Query Parameters:** `page` (default 0), `size` (default 50), `category` (optional)
- **Response (200 OK):**
```json
{
  "content": [
    {
      "id": "exp_1",
      "groupId": "grp_1",
      "title": "Monthly Rent Payment",
      "amount": 36000.00,
      "currency": "INR",
      "baseAmountINR": 36000.00,
      "exchangeRate": 1.0,
      "category": "rent",
      "paidByMemberId": "mem_1",
      "paidByName": "Animesh (You)",
      "splitType": "EQUAL",
      "shares": [
        { "memberId": "mem_1", "amount": 12000.00 },
        { "memberId": "mem_2", "amount": 12000.00 },
        { "memberId": "mem_3", "amount": 12000.00 }
      ],
      "date": "2026-08-01",
      "notes": "Paid via NetBanking for August",
      "receiptUri": null,
      "createdAt": "2026-08-01T12:00:00Z"
    }
  ],
  "totalElements": 1,
  "totalPages": 1
}
```

---

#### `POST /api/expense-groups/{groupId}/expenses`
Adds an expense and itemizes splits across group members.

- **Request Body:**
```json
{
  "title": "Seafood Dinner & Drinks",
  "amount": 6400.00,
  "currency": "INR",
  "payerId": "mem_3",
  "splitMode": "percentage", // "equal" | "percentage" | "shares"
  "category": "food",
  "date": "2026-08-07",
  "notes": "Beach shack dinner",
  "receiptUri": null,
  "splits": {
    "mem_1": 25.0,
    "mem_2": 25.0,
    "mem_3": 25.0,
    "mem_4": 25.0
  }
}
```
- **Validation Rules:**
  1. `title`: 1–120 characters, non-empty.
  2. `amount`: numeric, positive (> 0.00).
  3. `currency`: must be one of `INR`, `USD`, `EUR`, `AED`, `GBP`.
  4. `payerId`: must be a valid member ID in this group.
  5. `splitMode`:
     - If `"equal"`: `splits` map is optional. Backend splits evenly among all group members.
     - If `"percentage"`: values represent percentages. Sum must equal `100.0` (±0.5%).
     - If `"shares"`: values represent weight counts (e.g. `{"mem_1": 1, "mem_2": 2}`). Backend computes proportional fractions.
  6. `baseAmountINR`: Backend computes `amount * exchangeRate`.
- **Response (201 Created):** Full `Expense` entity with calculated `shares[].amount` in INR.

---

#### `GET /api/expense-groups/{groupId}/expenses/{expenseId}`
Gets single expense details with full split itemization and payer metadata.

- **Response (200 OK):** Full `Expense` entity.

---

#### `DELETE /api/expense-groups/{groupId}/expenses/{expenseId}`
Soft-deletes the expense, triggering recalculation of balances.

- **Response (204 No Content)**

---

### 4.4 Debt Settlements API

#### `GET /api/expense-groups/{groupId}/settlements`
List all settlements recorded for the group.

- **Response (200 OK):**
```json
[
  {
    "id": "set_1",
    "groupId": "grp_1",
    "payerMemberId": "mem_2",
    "payerName": "Rahul Sharma",
    "payeeMemberId": "mem_1",
    "payeeName": "Animesh (You)",
    "amount": 5000.00,
    "currency": "INR",
    "amountINR": 5000.00,
    "method": "UPI",
    "date": "2026-08-03",
    "notes": "Partial payment towards August rent",
    "createdAt": "2026-08-03T15:30:00Z"
  }
]
```

---

#### `POST /api/expense-groups/{groupId}/settlements`
Records a payment made between two members to settle debt.

- **Request Body:**
```json
{
  "payerMemberId": "mem_2",
  "payeeMemberId": "mem_1",
  "amount": 5000.00,
  "currency": "INR",
  "method": "UPI", // "UPI" | "CASH" | "BANK_TRANSFER"
  "date": "2026-08-03",
  "notes": "Settled via Google Pay"
}
```
- **Validation Rules:**
  1. `payerMemberId != payeeMemberId`.
  2. Both must be active group members.
  3. `amount` > 0.
- **Response (201 Created):** Created `Settlement` object.

---

### 4.5 Group Synchronization & Analytics API (Frontend High-Priority)

#### `GET /api/expense-groups/{groupId}/sync`
**Crucial for `GroupDetailsScreen.tsx`**: Returns group metadata, active expenses, settlements, computed balances, pairwise debts, and category spending analytics in a single performant payload.

- **Response (200 OK):**
```json
{
  "group": {
    "id": "grp_1",
    "name": "Home Rent & Bills",
    "emoji": "🏠",
    "category": "Rent & Living",
    "defaultCurrency": "INR",
    "members": [
      { "id": "mem_1", "name": "Animesh (You)", "avatar": "👨‍💻", "isOwner": true },
      { "id": "mem_2", "name": "Rahul Sharma", "avatar": "👨‍🦱", "isOwner": false },
      { "id": "mem_3", "name": "Priya Patel", "avatar": "👩‍🦰", "isOwner": false }
    ]
  },
  "totalSpendINR": 40500.00,
  "userNetBalanceINR": 17500.00,
  "expenses": [ /* Array of Expense */ ],
  "settlements": [ /* Array of Settlement */ ],
  "balances": [
    {
      "memberId": "mem_1",
      "memberName": "Animesh (You)",
      "avatar": "👨‍💻",
      "netBalanceINR": 17500.00
    },
    {
      "memberId": "mem_2",
      "memberName": "Rahul Sharma",
      "avatar": "👨‍🦱",
      "netBalanceINR": -8500.00
    },
    {
      "memberId": "mem_3",
      "memberName": "Priya Patel",
      "avatar": "👩‍🦰",
      "netBalanceINR": -9000.00
    }
  ],
  "pairwiseDebts": [
    {
      "id": "debt_mem_2_mem_1",
      "payerId": "mem_2",
      "payerName": "Rahul Sharma",
      "payerAvatar": "👨‍🦱",
      "payeeId": "mem_1",
      "payeeName": "Animesh (You)",
      "payeeAvatar": "👨‍💻",
      "amountINR": 8500.00
    },
    {
      "id": "debt_mem_3_mem_1",
      "payerId": "mem_3",
      "payerName": "Priya Patel",
      "payerAvatar": "👩‍🦰",
      "payeeId": "mem_1",
      "payeeName": "Animesh (You)",
      "payeeAvatar": "👨‍💻",
      "amountINR": 9000.00
    }
  ],
  "categoryBreakdown": {
    "rent": 36000.00,
    "bills": 4500.00
  }
}
```

---

### 4.6 Cross-Module Aggregations (Dashboard & Voice)

#### `GET /api/expenses/summary/30-day`
Used by `src/app/dashboard.tsx` to replace the static `₹12,450` spend tile:
- **Response (200 OK):**
```json
{
  "rolling30DaysSpendINR": 18450.00,
  "currency": "INR",
  "periodStart": "2026-07-27",
  "periodEnd": "2026-08-26"
}
```

---

## 5. Core Algorithms & Calculation Engine

The backend service layer (`ExpenseCalculationService`) must implement the following math:

### 5.1 Net Balance Formula
For each member $m$ in group $G$:

$$\text{NetBalance}(m) = \sum_{e \in E, \text{payer}=m} e.\text{baseAmount} - \sum_{e \in E} \text{share}(e, m) + \sum_{s \in S, \text{payer}=m} s.\text{amount} - \sum_{s \in S, \text{payee}=m} s.\text{amount}$$

- Positive Net Balance: The group owes this member money (they get back).
- Negative Net Balance: This member owes money to the group.
- The sum of all net balances in a group must always equal 0: $\sum_{m \in G} \text{NetBalance}(m) = 0$.

---

### 5.2 Pairwise Debt Minimization Algorithm
To avoid $N \times (N-1)$ cross-transfers, the backend simplifies debts into minimal transactions:

```java
// Java 21 / Spring Service Implementation Example
public List<PairwiseDebtDTO> simplifyDebts(List<MemberBalance> balances) {
    // Separate into debtors (net < -1.0) and creditors (net > 1.0)
    List<MemberBalance> debtors = balances.stream()
        .filter(b -> b.getNetBalance() < -1.0)
        .map(MemberBalance::copy)
        .sorted(Comparator.comparingDouble(MemberBalance::getNetBalance))
        .collect(Collectors.toList());

    List<MemberBalance> creditors = balances.stream()
        .filter(b -> b.getNetBalance() > 1.0)
        .map(MemberBalance::copy)
        .sorted(Comparator.comparingDouble(MemberBalance::getNetBalance).reversed())
        .collect(Collectors.toList());

    List<PairwiseDebtDTO> debts = new ArrayList<>();
    int dIdx = 0, cIdx = 0;

    while (dIdx < debtors.size() && cIdx < creditors.size()) {
        MemberBalance debtor = debtors.get(dIdx);
        MemberBalance creditor = creditors.get(cIdx);

        double owe = Math.abs(debtor.getNetBalance());
        double get = creditor.getNetBalance();
        double settleAmount = Math.min(owe, get);

        if (settleAmount >= 1.0) {
            debts.add(new PairwiseDebtDTO(
                "debt_" + debtor.getMemberId() + "_" + creditor.getMemberId(),
                debtor.getMemberId(), debtor.getName(), debtor.getAvatar(),
                creditor.getMemberId(), creditor.getName(), creditor.getAvatar(),
                Math.round(settleAmount)
            ));
        }

        debtor.setNetBalance(debtor.getNetBalance() + settleAmount);
        creditor.setNetBalance(creditor.getNetBalance() - settleAmount);

        if (Math.abs(debtor.getNetBalance()) < 1.0) dIdx++;
        if (Math.abs(creditor.getNetBalance()) < 1.0) cIdx++;
    }

    return debts;
}
```

---

## 6. PostgreSQL Database Schema (Flyway DDL)

Filename: `V11__multi_currency_expenses.sql` (Module 11 in Habita SRS)

```sql
-- 1. EXPENSE GROUPS TABLE
CREATE TABLE expense_groups (
    id VARCHAR(64) PRIMARY KEY,
    family_id VARCHAR(64),
    owner_user_id VARCHAR(64) NOT NULL,
    name VARCHAR(120) NOT NULL,
    emoji VARCHAR(16) NOT NULL DEFAULT '👥',
    category VARCHAR(60) NOT NULL DEFAULT 'General',
    default_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX idx_expense_groups_owner ON expense_groups(owner_user_id);
CREATE INDEX idx_expense_groups_family ON expense_groups(family_id);

-- 2. GROUP MEMBERS TABLE
CREATE TABLE expense_group_members (
    id VARCHAR(64) PRIMARY KEY,
    group_id VARCHAR(64) NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NULL, -- Nullable for ad-hoc or unlinked members
    name VARCHAR(120) NOT NULL,
    avatar VARCHAR(255) NOT NULL DEFAULT '👤',
    phone VARCHAR(30) NULL,
    is_owner BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_group_members_group ON expense_group_members(group_id);
CREATE INDEX idx_group_members_user ON expense_group_members(user_id);

-- 3. EXPENSES TABLE
CREATE TABLE group_expenses (
    id VARCHAR(64) PRIMARY KEY,
    group_id VARCHAR(64) NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    exchange_rate NUMERIC(10, 4) NOT NULL DEFAULT 1.0000,
    base_amount_inr NUMERIC(12, 2) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'food',
    paid_by_member_id VARCHAR(64) NOT NULL REFERENCES expense_group_members(id),
    split_type VARCHAR(20) NOT NULL CHECK (split_type IN ('EQUAL', 'PERCENTAGE', 'SHARES')),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT NULL,
    receipt_url TEXT NULL,
    shares JSONB NOT NULL, -- Structured JSONB array: [{"memberId": "...", "amount": 1200.00, "percentage": 25.0}]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX idx_group_expenses_group ON group_expenses(group_id);
CREATE INDEX idx_group_expenses_date ON group_expenses(expense_date);
CREATE INDEX idx_group_expenses_deleted ON group_expenses(deleted_at);

-- 4. SETTLEMENTS TABLE
CREATE TABLE expense_settlements (
    id VARCHAR(64) PRIMARY KEY,
    group_id VARCHAR(64) NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
    payer_member_id VARCHAR(64) NOT NULL REFERENCES expense_group_members(id),
    payee_member_id VARCHAR(64) NOT NULL REFERENCES expense_group_members(id),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    amount_inr NUMERIC(12, 2) NOT NULL,
    method VARCHAR(30) NOT NULL CHECK (method IN ('UPI', 'CASH', 'BANK_TRANSFER')),
    settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_settlements_group ON expense_settlements(group_id);
CREATE INDEX idx_settlements_payer ON expense_settlements(payer_member_id);
CREATE INDEX idx_settlements_payee ON expense_settlements(payee_member_id);
```

---

## 7. Error Codes & Format

Following Spring Boot global exception handler conventions (`@ControllerAdvice`):

| HTTP Status | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `INVALID_SPLIT_PERCENTAGE` | Split percentages sum to e.g. 95% instead of 100%. |
| `400 Bad Request` | `MEMBER_HAS_UNSETTLED_DEBT` | Attempting to remove member with non-zero balance. |
| `400 Bad Request` | `INVALID_CURRENCY` | Currency code not in supported set. |
| `403 Forbidden` | `NOT_GROUP_MEMBER` | Caller is not a member of the requested expense group. |
| `404 Not Found` | `GROUP_NOT_FOUND` | Group does not exist or has been deleted. |
| `404 Not Found` | `EXPENSE_NOT_FOUND` | Expense ID does not exist in this group. |

**Standard Error Payload:**
```json
{
  "timestamp": "2026-08-26T22:15:00Z",
  "status": 400,
  "error": "Bad Request",
  "code": "INVALID_SPLIT_PERCENTAGE",
  "message": "Split percentages must sum to 100.0%. Current sum is 95.0%",
  "path": "/api/expense-groups/grp_1/expenses"
}
```

---

## 8. Client Migration Path (`expenseStore.ts` Integration)

Once the backend is deployed, `src/features/money/expenseStore.ts` will be switched from `AsyncStorage` to network calls using `apiFetch` (following the exact pattern established in `src/features/family/api.ts` and `src/features/medicine/api.ts`):

1. `loadGroups()` $\to$ `GET /api/expense-groups`
2. `createGroup(name, emoji, members)` $\to$ `POST /api/expense-groups`
3. `getGroupSyncDetails(groupId)` $\to$ `GET /api/expense-groups/{groupId}/sync`
4. `addExpenseToGroup(groupId, data)` $\to$ `POST /api/expense-groups/{groupId}/expenses`
5. `settlePairwiseDebt(groupId, payer, payee, method)` $\to$ `POST /api/expense-groups/{groupId}/settlements`

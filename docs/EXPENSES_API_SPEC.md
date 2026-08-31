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
1. **Multi-Currency Groups:** Create and manage expense groups with a custom icon (a lucide icon key, e.g. `"house"` — see §3.5), categories, and member lists with a default currency (INR, USD, EUR, AED, GBP).
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

### 3.5 Group Icon Key
```typescript
type GroupIconKey =
  | 'house'
  | 'umbrella'
  | 'popcorn'
  | 'car'
  | 'graduation-cap'
  | 'plane'
  | 'hamburger'
  | 'gift'
  | 'users'; // default/fallback
```
The `emoji` field on `ExpenseGroup` (kept as `emoji` for backward-compatible naming,
despite the contents no longer being an emoji character — see the 2026-08-29 contract
change below) holds one of these keys. The client resolves each key directly to a
`lucide-react-native` icon component of the same name (kebab-case file name = icon
key), so no separate translation table needs to be kept in sync between frontend and
backend — an unrecognized/unknown key should just fall back to `'users'` client-side,
and the backend should validate incoming values against this enum (reject anything
else with `400 Bad Request` / `INVALID_ICON_KEY`).

> **Note (contract change, 2026-08-29):** `emoji` previously held a raw emoji character
> (e.g. `"🏠"`). It now holds one of the icon keys above (e.g. `"house"`) as part of a
> project-wide removal of emoji from the app — see `docs/DECISIONS.md` D-054. Widen the
> column if it was sized for a single emoji grapheme (`VARCHAR(16)` is fine for the
> longest key, `graduation-cap`, but see §6's DDL update).

---

## 4. REST API Endpoint Specifications

Base Path: `/api/expense-groups`

### 4.1 Groups API

#### `GET /api/expense-groups`
Retrieves expense groups for the authenticated user, along with the user's net balance
in each group and an overall summary.

> **Contract change (2026-08-29):** This endpoint is now paginated — see the mobile
> client's Groups list, which shows real Prev/Next controls driven by this response's
> `page`/`totalPages`, not a client-side slice of an already-fully-loaded list.

- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters (both optional):**
  - `page` — 0-indexed page number. Default `0`.
  - `size` — page size. Default `8` (matches the mobile client's `GROUPS_PAGE_SIZE`,
    but the client sends its own `size` explicitly, so the backend default only matters
    for other callers).
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
      "emoji": "house",
      "category": "Rent & Living",
      "defaultCurrency": "INR",
      "ownerUserId": "usr_me_123",
      "memberCount": 3,
      "expenseCount": 2,
      "userNetBalanceINR": 17500.00,
      "status": "YOU_GET_BACK", // "YOU_GET_BACK" | "YOU_OWE" | "SETTLED_UP"
      "createdAt": "2026-08-01T00:00:00Z"
    }
  ],
  "page": 0,
  "size": 8,
  "totalElements": 23,
  "totalPages": 3
}
```
- **Critical: `summary` is always the caller's full aggregate across *every* group they
  belong to** — `totalSpentINR`/`youAreOwedINR`/`youOweINR` must **not** be recomputed
  from just the `groups` on this page. Only the `groups` array itself is paginated;
  `summary` is identical no matter which `page`/`size` was requested.
- `page`/`size`/`totalElements`/`totalPages` are new fields — a client built before this
  contract change tolerates their absence (treats a response missing them as one
  unpaginated page), so this is safe to ship without breaking the previous behavior.

---

#### `POST /api/expense-groups`
Creates a new expense group. The creator is automatically added as the owner and first member.

- **Request Body:**
```json
{
  "name": "Weekend Goa Trip",
  "emoji": "umbrella",
  "category": "Travel & Fun",
  "defaultCurrency": "INR",
  "members": [
    { "name": "Rahul Sharma", "phone": "+919876543210" },
    { "name": "Priya Patel" }
  ]
}
```
Note: a member's `avatarUrl` is never sent by the client on create — it is always
resolved server-side (`null` for an ad-hoc/unlinked member, or the linked user's own
photo when `phone` resolves to a registered account). See §3.5's note and §4.2.1.
- **Response (201 Created):**
```json
{
  "id": "grp_2",
  "name": "Weekend Goa Trip",
  "emoji": "umbrella",
  "category": "Travel & Fun",
  "defaultCurrency": "INR",
  "ownerUserId": "usr_me_123",
  "members": [
    { "id": "mem_1", "userId": "usr_me_123", "name": "Animesh", "avatarUrl": "https://cdn.habita.app/avatars/usr_me_123.jpg?X-Amz-Expires=600&...", "isOwner": true },
    { "id": "mem_2", "userId": null, "name": "Rahul Sharma", "avatarUrl": null, "isOwner": false },
    { "id": "mem_3", "userId": null, "name": "Priya Patel", "avatarUrl": null, "isOwner": false }
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
  "emoji": "house",
  "category": "Rent & Living",
  "defaultCurrency": "INR",
  "ownerUserId": "usr_me_123",
  "members": [
    { "id": "mem_1", "userId": "usr_me_123", "name": "Animesh (You)", "avatarUrl": "https://cdn.habita.app/avatars/usr_me_123.jpg?X-Amz-Expires=600&...", "isOwner": true },
    { "id": "mem_2", "userId": "usr_2", "name": "Rahul Sharma", "avatarUrl": null, "isOwner": false },
    { "id": "mem_3", "userId": "usr_3", "name": "Priya Patel", "avatarUrl": null, "isOwner": false }
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
  "emoji": "umbrella",
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

> **Note (contract change, 2026-08-29):** The client no longer sends an unverified phone
> number and lets the backend silently resolve it (the old §5.3 "auto-linking" flow
> below). It now calls the new **`GET /api/expense-groups/members/lookup-by-phone`**
> endpoint first, shows the caller a "Verified" state with the real registered name, and
> only then submits the member — always with an explicit `userId` when the phone
> matched a registered user. See §4.2.1 and §5.3 for the full new lifecycle.

#### `GET /api/expense-groups/members/lookup-by-phone?phone={phone}`
Looks up whether a phone number belongs to a registered user, **without** creating or
modifying anything. Used by the "add member by phone" UI to show a verified badge and
prefill the real name *before* the member is actually added — at group-creation time
(`POST /api/expense-groups`) or afterward (`POST /api/expense-groups/{groupId}/members`).

- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters:** `phone` (required) — any reasonable format is accepted; the
  backend applies the same sanitization/normalization rules as §5.3.1 (strip
  spaces/hyphens, prepend `+91` for bare 10-digit Indian numbers) before looking it up.
- **Response (200 OK)** — a registered user exists for this phone:
```json
{
  "userId": "usr_2",
  "name": "Rahul Sharma",
  "avatarUrl": "https://cdn.habita.app/avatars/usr_2.jpg?X-Amz-Expires=600&...",
  "phone": "+919876543210"
}
```
`avatarUrl` is `null` when the matched user has no uploaded photo — never omitted, and
never a stand-in emoji/placeholder value.
- **Response (404 Not Found)** — no registered user matches this phone number:
```json
{
  "timestamp": "2026-08-29T10:00:00Z",
  "status": 404,
  "error": "Not Found",
  "code": "USER_NOT_FOUND",
  "message": "No registered user found with this phone number",
  "path": "/api/expense-groups/members/lookup-by-phone"
}
```
- **Response (400 Bad Request)** — `phone` missing or fails the E.164-ish validator
  (`^\+?[0-9]{10,13}$` pre-normalization).
- **Notes:**
  - Read-only and idempotent — safe to call on every keystroke-debounce / blur, no rate
    limiting beyond whatever applies to the API globally.
  - Requires an authenticated caller (any logged-in user), but **not** group membership —
    this runs before a group necessarily exists (group-creation flow) and before the
    looked-up person is a member of anything.
  - Must reuse the exact same phone sanitization/normalization as member creation (§5.3.1)
    so that a phone verified here always matches what gets persisted on add.

---

#### `POST /api/expense-groups/{groupId}/members`
Adds a member to an existing group — either a previously-verified registered user
(`userId` + `phone` set, from a successful `lookup-by-phone` call) or an ad-hoc member
added by name only (no `phone`, no `userId`). See §4.2.1 for why the backend should
**not** perform its own unverified phone resolution anymore.

- **Request Body (verified registered user):**
```json
{
  "name": "Rohan Gupta",
  "phone": "+919123456789",
  "userId": "usr_9"
}
```
- **Request Body (ad-hoc member, no phone):**
```json
{
  "name": "Rohan Gupta"
}
```
- **Response (201 Created):** `GroupMember` object — `avatarUrl` resolved server-side
  as described in §3.5's note (never client-supplied).

---

#### 4.2.1 Why the flow changed

The original design (§5.3 below, kept for historical/reference context) resolved a
phone number to a user **silently inside** `POST /api/expense-groups` /
`POST /api/expense-groups/{groupId}/members`: the client sent a raw phone number, and
the backend decided — invisibly to the user — whether it matched a real account. The
product requirement is now that the *person creating the group* sees that resolution
happen and confirms it before the member is added:

1. Client calls `GET /api/expense-groups/members/lookup-by-phone?phone=...`.
2. **Match found:** UI shows a "Verified" badge and the registered user's real name
   (editable override still allowed). On "Add", the client submits the member with that
   `userId` + normalized `phone` already attached — the backend should **trust and
   store this `userId` as-is** (after re-validating the phone still resolves to that user
   — see below) rather than re-deriving it.
3. **No match found:** UI tells the user no registered account exists for that number
   and offers "Add without phone number" — the client then submits the member with
   **no `phone` and no `userId`**, name-only, same as any other ad-hoc member.
4. The backend should still defensively re-validate on write: if a `phone` is present on
   the member-create payload, re-run the §5.3.1 lookup server-side and use the freshly
   resolved `userId` (ignore/overwrite a client-supplied `userId` that doesn't match what
   that phone currently resolves to). This keeps the endpoint safe against a stale
   verification (the number could have been claimed by a different account between the
   lookup call and the add call) without reintroducing silent unverified-phone linking:
   a `phone` should never be persisted on a member row without a corresponding resolved
   `userId` from server-side lookup. If the client sends a `phone` that no longer
   resolves to any user, reject with `400 Bad Request` /
   `PHONE_NO_LONGER_REGISTERED` rather than silently storing it as an ad-hoc phone number
   — the whole point of this flow is that a phone attached to a member is always a
   verified, currently-registered user.
5. The §5.3.5 "Post-Registration Auto-Claim Hook" is unaffected — it is unrelated to this
   change since it only concerns pre-existing ad-hoc members with no `userId`.

---

#### `DELETE /api/expense-groups/{groupId}/members/{memberId}`
Removes a member from a group.
- **Precondition:** Member's net balance must be `0.00`. If net balance != 0, returns `400 Bad Request` (`"Cannot remove member with unsettled balance"`).
- **Response (204 No Content)**

---

### 4.3 Expenses API

#### `GET /api/expense-groups/{groupId}/expenses`
List expenses for the group with optional pagination.

> **Client integration (2026-08-29):** the mobile client's GroupDetails "Expenses" tab
> now calls this endpoint directly (with `size=10`, its `EXPENSES_PAGE_SIZE`) and
> renders real Prev/Next controls off `totalPages`, grouping the returned page under
> date headers ("Today" / "Yesterday" / "12 Aug 2026" — see `groupExpensesByDate()` in
> `expenseStore.ts`). It no longer relies on `/sync`'s bundled `expenses` array for this
> tab — see §4.5's note. If the backend ignores `page`/`size` and returns every expense
> as a plain array instead of `{content, totalElements, totalPages}`, the client detects
> that (`Array.isArray(res)`) and paginates it client-side as a graceful degradation —
> but the real fix is implementing pagination server-side per this endpoint's contract.

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
     - If `"equal"`: `splits` map is optional. Backend splits evenly among all group members using the 1-paisa distribution rule in §5.1.2 — shares must sum to exactly `amount`, never leave a rounding remainder unassigned.
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

> **Note (2026-08-29):** the mobile client still uses this endpoint's `group`,
> `balances`, `pairwiseDebts`, `categoryBreakdown`, `totalSpendINR`, and
> `userNetBalanceINR` for the Balances/Summary tabs and the hero total — those need the
> *complete* dataset, not one page. Its `expenses` array, however, is **no longer**
> what renders the Expenses tab's list (that's the paginated
> `GET /api/expense-groups/{groupId}/expenses` above) — it's still used as the source
> for the client-side total-spend fallback when `totalSpendINR` is absent, and as the
> offline cache the paginated-expenses fallback slices when there's no reachable
> backend. Keep returning the full `expenses` array here; don't paginate it — a second,
> separate pagination scheme on this endpoint would only add confusion.

> **New field `relationshipBalances` (2026-08-29):** `pairwiseDebts` is a *simplified
> settlement suggestion* — the minimum-transaction-count result of the greedy algorithm
> in §5.2, which in a group of 3+ members can route a suggested payment between two
> people who never actually shared an expense together. `relationshipBalances` is the
> **true, direct bilateral balance** between every pair who *did* transact — computed
> straight from each expense's shares and each settlement between that pair, with
> opposite-direction amounts netted (§5.2.1). Use `relationshipBalances`, not
> `pairwiseDebts`, to render "Owed by you" / "Owed to you" per-person sections; reserve
> `pairwiseDebts` for a "Settle Up" suggestion that minimizes the number of payments.
> In a 2-member group the two lists are always numerically identical — the difference
> only shows up once a group has 3+ members with a multi-way debt graph.

- **Response (200 OK):**
```json
{
  "group": {
    "id": "grp_1",
    "name": "Home Rent & Bills",
    "emoji": "house",
    "category": "Rent & Living",
    "defaultCurrency": "INR",
    "members": [
      { "id": "mem_1", "name": "Animesh (You)", "avatarUrl": "https://cdn.habita.app/avatars/usr_me_123.jpg?X-Amz-Expires=600&...", "isOwner": true },
      { "id": "mem_2", "name": "Rahul Sharma", "avatarUrl": null, "isOwner": false },
      { "id": "mem_3", "name": "Priya Patel", "avatarUrl": null, "isOwner": false }
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
      "avatarUrl": "https://cdn.habita.app/avatars/usr_me_123.jpg?X-Amz-Expires=600&...",
      "netBalanceINR": 17500.00
    },
    {
      "memberId": "mem_2",
      "memberName": "Rahul Sharma",
      "avatarUrl": null,
      "netBalanceINR": -8500.00
    },
    {
      "memberId": "mem_3",
      "memberName": "Priya Patel",
      "avatarUrl": null,
      "netBalanceINR": -9000.00
    }
  ],
  "pairwiseDebts": [
    {
      "id": "debt_mem_2_mem_1",
      "payerId": "mem_2",
      "payerName": "Rahul Sharma",
      "payerAvatarUrl": null,
      "payeeId": "mem_1",
      "payeeName": "Animesh (You)",
      "payeeAvatarUrl": "https://cdn.habita.app/avatars/usr_me_123.jpg?X-Amz-Expires=600&...",
      "amountINR": 8500.00
    },
    {
      "id": "debt_mem_3_mem_1",
      "payerId": "mem_3",
      "payerName": "Priya Patel",
      "payerAvatarUrl": null,
      "payeeId": "mem_1",
      "payeeName": "Animesh (You)",
      "payeeAvatarUrl": "https://cdn.habita.app/avatars/usr_me_123.jpg?X-Amz-Expires=600&...",
      "amountINR": 9000.00
    }
  ],
  "relationshipBalances": [
    {
      "id": "rel_mem_2_mem_1",
      "payerId": "mem_2",
      "payerName": "Rahul Sharma",
      "payerAvatarUrl": null,
      "payeeId": "mem_1",
      "payeeName": "Animesh (You)",
      "payeeAvatarUrl": "https://cdn.habita.app/avatars/usr_me_123.jpg?X-Amz-Expires=600&...",
      "amountINR": 8500.00
    },
    {
      "id": "rel_mem_3_mem_1",
      "payerId": "mem_3",
      "payerName": "Priya Patel",
      "payerAvatarUrl": null,
      "payeeId": "mem_1",
      "payeeName": "Animesh (You)",
      "payeeAvatarUrl": "https://cdn.habita.app/avatars/usr_me_123.jpg?X-Amz-Expires=600&...",
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

### 5.1.1 Worked Example — Matches Splitwise / Google Pay "Split Expenses"

This is the exact convention Splitwise and Google Pay's bill-splitting feature use, and
what the mobile client already implements client-side (`calculateGroupBalances()` in
`expenseStore.ts`) — quoted here numerically so the backend can be verified against it
directly, since this exact scenario is the one most commonly asked about:

> **2-member group, one ₹100 expense, paid by Member A, split EQUAL between A and B.**

1. The expense is itemized into **two shares of ₹50 each** — A's own ₹50 share *and*
   B's ₹50 share. A paying for the group does **not** mean A "keeps" the ₹100; A is
   still on the hook for their own ₹50 of it, exactly like every other member.
2. `NetBalance(A) = paid − share = 100 − 50 = +50` → **A gets back ₹50** (displayed as
   `status: YOU_GET_BACK`, `userNetBalanceINR: 50.00`).
3. `NetBalance(B) = paid − share = 0 − 50 = −50` → **B owes ₹50** (`YOU_OWE`,
   `-50.00`).
4. The pairwise debt this produces (§5.2) is `{payer: B, payee: A, amountINR: 50}` —
   "B owes A ₹50," shown on the Balances tab with a **Settle Up** action.
5. Balances still sum to zero: `(+50) + (-50) = 0`.

This is true **regardless of who's viewing the app** — A's screen shows "+₹50, you get
back," B's screen shows "-₹50, you owe" — both are describing the same underlying
`NetBalance` values from step 2/3, from each viewer's own perspective.

A 3-member variant, since it's the case that actually exercises rounding: **₹100 paid
by A, split equally among A/B/C.** ₹100 ÷ 3 = ₹33.33 repeating — see §5.1.2 for exactly
how the leftover paisa is assigned so the three shares still sum to ₹100.00 exactly.
With that rule, A/B/C's shares come out to ₹33.34/₹33.33/₹33.33 (A's own share gets the
odd paisa here only because of the specific tie-break rule below, not because A paid) →
`NetBalance(A) = 100 − 33.34 = +66.66`, `NetBalance(B) = NetBalance(C) = −33.33` each,
summing to `66.66 − 33.33 − 33.33 = 0.00` ✓.

### 5.1.2 Equal-Split Rounding: The 1-Paisa Distribution Rule

Referenced by §4.3's `splitMode: "equal"` validation rule. Naively dividing
`amount / memberCount` and rounding each share independently can leave the shares not
summing to the original total (₹100 ÷ 3 = ₹33.33 × 3 = ₹99.99 — one paisa short). Do
the division in **integer paise**, not floating-point rupees, and hand out the leftover
paise one each to avoid this:

```java
// Matches computeEqualSplitAmounts() in src/features/money/expenseStore.ts —
// keep both implementations in sync if either changes.
public Map<String, BigDecimal> computeEqualSplitAmounts(BigDecimal totalINR, List<String> memberIds) {
    int n = Math.max(memberIds.size(), 1);
    long totalPaise = totalINR.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
    long basePaise = totalPaise / n;
    long remainder = totalPaise - basePaise * n; // 0 <= remainder < n

    Map<String, BigDecimal> result = new LinkedHashMap<>();
    for (int i = 0; i < memberIds.size(); i++) {
        long paise = basePaise + (i < remainder ? 1 : 0);
        result.put(memberIds.get(i), BigDecimal.valueOf(paise, 2)); // paise -> rupees
    }
    return result;
}
```

- `memberIds` order must be **deterministic** (e.g. the group's stored member order) —
  the first `remainder` members in that order each get one extra paisa, not a random
  or payer-first assignment. The mobile client uses `group.members` array order.
  Whichever order the backend picks, both sides must agree, or the same expense could
  itemize slightly differently between an offline-created copy and the server's version.
- This guarantees `sum(shares) === totalPaise` exactly, every time — never trust
  `Math.round` per-share without a remainder pass, since that's what produces the
  ₹99.99-of-₹100 class of bug.

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
                debtor.getMemberId(), debtor.getName(), debtor.getAvatarUrl(),
                creditor.getMemberId(), creditor.getName(), creditor.getAvatarUrl(),
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

### 5.2.1 Relationship Balances — True Bilateral Debt (`relationshipBalances`)

> **New (2026-08-29).** Backs the `relationshipBalances` field on `GET /{groupId}/sync`
> (§4.5). Where §5.2's `simplifyDebts` produces a *minimum-transaction-count suggestion*
> that can route a payment between two people who never shared an expense, this computes
> the **actual** amount each pair owes each other, straight from the ledger. Used for
> "Owed by you" / "Owed to you" per-person UI sections; `pairwiseDebts` stays reserved for
> a "Settle Up" minimized-transaction suggestion.

**Algorithm** — for every ordered pair `(from, to)`, accumulate a raw directional amount,
then net the two directions of each unordered pair down to one signed relationship:

1. For every non-deleted expense: for every share where `share.memberId != paidByMember`,
   add `share.amount` to `owed[participant][payer]` — "participant owes payer their
   share." The payer's own share (if included in the split) contributes nothing, since
   they can't owe themselves.
2. For every settlement: subtract `settlement.amount` from `owed[payer][payee]` — a
   settlement payment *reduces* what the payer owes the payee (and can flip it negative,
   i.e. into an overpayment/reverse debt, if it exceeds what was owed).
3. For every unordered pair `{A, B}`: `net = owed[A][B] − owed[B][A]`. If `net > 0.01`,
   A owes B `net`. If `net < -0.01`, B owes A `abs(net)`. Otherwise the pair has no
   relationship entry at all (fully settled or never transacted).

```java
public List<PairwiseDebtDTO> calculateRelationshipBalances(
        List<ExpenseGroupMember> members,
        List<GroupExpense> expenses,
        List<ExpenseSettlement> settlements
) {
    Map<String, Map<String, BigDecimal>> owed = new LinkedHashMap<>();

    for (GroupExpense exp : expenses) {
        if (exp.isDeleted()) continue;
        String payerId = exp.getPaidByMember().getId();
        for (ExpenseShare share : exp.getShares()) {
            if (share.getMemberId().equals(payerId)) continue;
            owed.computeIfAbsent(share.getMemberId(), k -> new LinkedHashMap<>())
                .merge(payerId, share.getAmount(), BigDecimal::add);
        }
    }

    for (ExpenseSettlement s : settlements) {
        owed.computeIfAbsent(s.getPayerMember().getId(), k -> new LinkedHashMap<>())
            .merge(s.getPayeeMember().getId(), s.getAmountInr().negate(), BigDecimal::add);
    }

    // net each unordered pair {A, B}: owed[A][B] - owed[B][A]; emit only if |net| >= 0.01
    // ... (see ExpenseCalculationService.calculateRelationshipBalances for the full pair loop)
}
```

**Worked example — why a 100%/0% percentage split shows "Settled":**

> 2-member group, ₹180 expense, paid by you, `splitMode: "percentage"`,
> `splits: { you: 100, friend: 0 }`.

This means "the whole ₹180 is attributed to me; my friend consumed none of it" — **not**
"I paid, so split it evenly." Shares come out to `you: 180.00, friend: 0.00`.
`NetBalance(you) = paid(180) − share(180) = 0`. `NetBalance(friend) = paid(0) − share(0)
= 0`. Both zero → `relationshipBalances` is empty and the group correctly shows
"Settled." **This is not a bug.** To get "friend owes me ₹90," use `splitMode: "equal"`
(or `"percentage"` with `{ you: 50, friend: 50 }`) — see §5.1.1's worked example for the
₹100-expense equivalent of exactly this scenario.

**Opposite-direction netting example** (mirrored in
`ExpenseCalculationServiceTest.testRelationshipBalanceNetsOppositeDirectionDebts`):

> Expense 1: B pays ₹1,000, split equally A/B → A owes B ₹500.
> Expense 2: A pays ₹600, split equally A/B → B owes A ₹300.
> Net relationship: **A owes B ₹200** (₹500 − ₹300), a single entry — never both
> directions at once for the same pair.

---

### 5.3 Mobile Number Member Resolution & Direct Auto-Linking Engine

> **Status: retained as the server-side lookup/validation engine, no longer the primary
> client-facing UX.** Per §4.2.1, the client now calls
> `GET /api/expense-groups/members/lookup-by-phone` explicitly and shows the result
> before the member is added, instead of silently discovering the resolution after the
> fact. The algorithm below (phone sanitization, `findByPhone` lookup, Branch A/B split)
> is exactly what `lookup-by-phone` should run read-only, and what member-create should
> re-run server-side to validate a client-supplied `phone`/`userId` pair (§4.2.1 step 4).
> Section 5.3.5 (auto-claim on signup) is unchanged and still runs independently.

When a creator adds a member to an expense group using a mobile phone number (either at group creation via `POST /api/expense-groups` or via `POST /api/expense-groups/{groupId}/members`), the backend performs automatic identity resolution and direct linking:

#### Algorithm & Lifecycle Rules:

1. **Phone Number Sanitization & Normalization:**
   - Strip all spaces, hyphens, and formatting: `phone.replaceAll("[\\s()-]", "")`.
   - Normalize standard 10-digit Indian mobile numbers by prepending `+91` if country code is omitted (e.g. `9876543210` -> `+919876543210`).
   - Validate against E.164 phone format (`^\+[1-9]\d{1,14}$`).

2. **Database Lookup in `users` Table:**
   ```java
   Optional<User> existingUserOpt = userRepository.findByPhone(normalizedPhone);
   ```

3. **Branch A: User Exists in System (`existingUserOpt.isPresent()`):**
   - Directly link the user's account: `member.setUserId(user.getId())`.
   - Prefer registered user profile details:
     - `member.setName(StringUtils.hasText(memberInput.getName()) ? memberInput.getName() : user.getName())`
     - `member.setPhone(user.getPhone())`
   - **`avatarUrl` is never persisted on the member row** — it's a presigned S3 URL that
     expires in ~10 minutes, so storing it would go stale. It's computed at response-time
     (see the DTO mapping note below) by joining through `user_id` to that user's own
     current profile photo, the same way `GET /profile/details` resolves its own
     `avatarUrl`. `null` when the linked user has no uploaded photo.
   - **Immediate Client Availability:** Because `user_id` is set, this expense group immediately appears in the target user's `GET /api/expense-groups` list with full real-time access.

4. **Branch B: User Does NOT Exist in System (`existingUserOpt.isEmpty()`):**
   - Store as an unlinked ad-hoc member:
     - `member.setUserId(null)`
     - `member.setPhone(normalizedPhone)`
     - `member.setName(StringUtils.hasText(memberInput.getName()) ? memberInput.getName() : normalizedPhone)`
   - `avatarUrl` in the API response is `null` for every ad-hoc member (no `user_id` to
     resolve a photo from).
   - The member participates in all expense itemizations, balances, and settlements seamlessly.

5. **Post-Registration Auto-Claim Hook (On User Signup):**
   - When a new user completes phone OTP signup:
     ```sql
     UPDATE expense_group_members
     SET user_id = :newUserId
     WHERE phone = :normalizedPhone
       AND user_id IS NULL;
     ```
   - All historical expense groups where this phone was added are automatically claimed
     and linked upon first login — no avatar-related column to backfill, since
     `avatarUrl` is computed from `user_id` at response-time, not stored.

#### Spring Boot Service Reference Implementation:

```java
@Service
@RequiredArgsConstructor
public class ExpenseGroupMemberService {

    private final UserRepository userRepository;
    private final ExpenseGroupMemberRepository memberRepository;

    @Transactional
    public ExpenseGroupMember resolveAndAddMember(ExpenseGroup group, CreateMemberDTO input) {
        String normalizedPhone = sanitizePhoneNumber(input.getPhone());
        String memberId = "mem_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

        ExpenseGroupMember member = new ExpenseGroupMember();
        member.setId(memberId);
        member.setGroup(group);
        member.setPhone(normalizedPhone);

        if (StringUtils.hasText(normalizedPhone)) {
            Optional<User> registeredUser = userRepository.findByPhone(normalizedPhone);
            if (registeredUser.isPresent()) {
                User user = registeredUser.get();
                member.setUserId(user.getId());
                member.setName(StringUtils.hasText(input.getName()) ? input.getName() : user.getName());
            } else {
                member.setUserId(null);
                member.setName(StringUtils.hasText(input.getName()) ? input.getName() : normalizedPhone);
            }
        } else {
            member.setUserId(input.getUserId());
            member.setName(input.getName());
        }

        return memberRepository.save(member);
    }

    private String sanitizePhoneNumber(String raw) {
        if (!StringUtils.hasText(raw)) return null;
        String digits = raw.replaceAll("[\\s()-]", "");
        if (digits.length() == 10 && !digits.startsWith("+")) {
            return "+91" + digits;
        }
        return digits;
    }
}
```

`avatarUrl` is never set on the `ExpenseGroupMember` entity — it's a transient field on
the response DTO, populated at mapping-time by resolving `member.getUserId()` (when
non-null) to that user's current profile photo and freshly presigning it, exactly like
`GET /profile/details` does for the caller's own photo. This keeps the URL always fresh
and needs no backfill when a member's linked account changes its photo.

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
    emoji VARCHAR(32) NOT NULL DEFAULT 'users', -- lucide icon key, e.g. "house" (see §3.5) — not an emoji character despite the column name
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
    -- No avatar/avatar_url column: a member's avatarUrl is never persisted here (it
    -- would go stale, since it's a short-lived presigned URL) — it's resolved at
    -- response-time by joining user_id to that user's current profile photo. See §5.3.
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
| `404 Not Found` | `USER_NOT_FOUND` | `lookup-by-phone` found no registered user for the given phone number. |
| `400 Bad Request` | `PHONE_NO_LONGER_REGISTERED` | Member-create sent a `phone` that no longer resolves to any registered user server-side (see §4.2.1). |

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

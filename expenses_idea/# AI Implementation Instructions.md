# AI Implementation Instructions

You are implementing a production-grade group expense-sharing feature.

Read all documentation under:

docs/

before changing code.

Do not implement based on assumptions.

---

# Primary Goal

Build a group expense-sharing system similar in concept to Google Pay group expenses.

The feature must allow:

- create group
- add members
- create expenses
- split expenses
- calculate balances
- show who owes whom
- show "owed by me"
- show "owed to me"
- show settled relationships
- record settlements
- suggest simplified settlements

---

# Critical Financial Rules

Money must NEVER use JavaScript floating point arithmetic.

Use integer minor units.

For INR:

₹1 = 100 paise

Example:

₹125.50

must be stored as:

12550

---

# Architecture

Separate:

UI
API
Domain/business logic
Database

Do not put balance calculation inside React components.

Do not duplicate financial calculations across screens.

Create one central financial domain/service layer.

Recommended:

calculateExpenseShares()
calculateGroupBalances()
calculateUserBalance()
simplifyDebts()
calculateRelationshipBalances()
validateExpense()
validateSettlement()

---

# Source of Truth

Expenses and settlements are the source of truth.

Do not manually modify balances when creating an expense.

Do not manually modify balances when creating a settlement.

Balances must be derivable from the ledger.

---

# Expense Flow

When creating an expense:

1. Validate group.
2. Validate payer.
3. Validate participants.
4. Validate amount.
5. Calculate shares.
6. Validate share total.
7. Insert expense.
8. Insert expense shares.
9. Commit transaction.
10. Return expense.
11. Refresh/recalculate balances.

---

# Balance Algorithm

For every member:

balance = 0

For every expense:

balance[paidBy] += expense.totalAmount

For every expense share:

balance[user] -= share.amount

For every completed settlement:

balance[fromUser] += settlement.amount
balance[toUser] -= settlement.amount

Then verify:

sum(balance.values()) == 0

---

# Relationship Balances

The application should also calculate direct relationships between users.

For each expense:

If payer != participant:

participant owes payer the participant's share.

Example:

A paid ₹900.

B share = ₹300.

Relationship:

B → A ₹300

For every settlement:

from → to amount

Settlement reduces that relationship.

Example:

B → A ₹300

Settlement:

B → A ₹100

Remaining:

B → A ₹200

Opposite directions must be netted.

Example:

A → B ₹500
B → A ₹200

Result:

A → B ₹300

---

# UI Sections

The current user's group balance page must provide:

## Owed by you

People the current user needs to pay.

## Owed to you

People who need to pay the current user.

## Settled

Relationships with zero outstanding amount where historical settlement exists.

## Expenses

Original expense history.

## Settle up

Recommended settlement actions.

---

# Debt Simplification

Implement:

simplifyDebts(balances)

Input:

Map<UserId, Money>

Positive = creditor

Negative = debtor

Output:

SettlementSuggestion[]

Use greedy largest-creditor/largest-debtor matching.

Do not modify the underlying expense ledger.

---

# Example

Input:

Pranay +400
Rahul +100
Amit -500

Output:

Amit → Pranay ₹400
Amit → Rahul ₹100

---

# API

Implement APIs described in:

docs/08-api-specification.md

Do not invent incompatible payload formats.

---

# Database

Implement schema described in:

docs/07-database-schema.md

Use foreign keys.

Use indexes for:

group_id
user_id
expense_id
settlement group

---

# Transactions

Expense creation must be atomic.

Settlement creation must be atomic.

If any step fails:

rollback everything.

---

# Editing

If an expense is edited:

recalculate affected balances.

Never leave stale balance data.

---

# Deletion

Use soft delete for expenses.

Recalculate balances after deletion.

---

# UI Requirements

Do not use emoji for financial states.

Do not introduce decorative emoji.

Use the existing application's icon system.

Keep the UI mature and professional.

Use consistent:

spacing
typography
icons
buttons
colors
navigation

Do not create a completely separate design language for this feature.

---

# Performance

For normal groups:

calculate balances efficiently.

For large groups:

avoid N+1 queries.

Use aggregated SQL queries where appropriate.

Cache derived balances only after correctness is established.

---

# Security

A user must not be able to:

- read another group's expenses
- add users to another group's group
- create expenses in another group
- create settlements in another group
- modify another user's private data

Every group resource must verify membership.

---

# Testing

Before declaring the implementation complete:

Run:

unit tests
integration tests
API tests

At minimum test:

equal split
exact split
percentage split
shares split
rounding
partial settlement
full settlement
opposite debts
multiple expenses
circular debts
member leaving
expense deletion
expense editing
debt simplification

Most importantly verify:

SUM(all balances) == 0

and:

After applying all suggested settlements:

all balances == 0

---

# Do Not

Do not:

- use floating point for money
- store only pairwise debts as the source of truth
- modify expenses when settling
- duplicate balance logic
- calculate balances in UI
- use AI/LLM for arithmetic
- use approximate money calculations
- silently round money
- ignore remainder paise
- create settlements without validation

---

# Implementation Order

Implement in this exact order:

1. Database schema
2. Domain types
3. Money utilities
4. Split calculation
5. Expense validation
6. Expense creation
7. Balance calculation
8. Relationship calculation
9. Settlement creation
10. Debt simplification
11. APIs
12. Unit tests
13. Integration tests
14. UI
15. Loading/error states
16. Performance optimization

Do not start with UI.

The financial engine must be correct first.

---

# Definition of Done

The feature is complete only when:

- Expenses can be created.
- Expenses can be split.
- Balances are correct.
- "Owed by you" is correct.
- "Owed to you" is correct.
- Settlements are recorded.
- Partial settlements work.
- Multiple expenses can be settled together.
- Debt simplification works.
- Original expenses remain immutable/history-safe.
- Balance sum is always zero.
- Settlement suggestions clear all balances.
- Money calculations are exact.
- Tests pass.
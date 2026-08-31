# Business Rules

## Group

1. A user must belong to a group to create expenses.
2. Only active members can participate in new expenses.
3. A removed member's historical expenses must remain intact.
4. Archived groups are read-only.

---

# Expense

1. Amount must be > 0.
2. Payer must belong to group.
3. Participants must belong to group.
4. Every participant must have exactly one share.
5. Sum of shares must equal total.
6. Currency must match group currency.
7. Expense cannot contain duplicate participants.
8. Expense creation must be transactional.

---

# Equal Split

The sum of generated shares must exactly equal the original amount.

Rounding remainder must be assigned deterministically.

---

# Exact Split

Sum(shares) must equal total exactly.

---

# Percentage Split

Sum(percentages) must equal 100%.

---

# Shares Split

Total shares must be > 0.

---

# Balance

For every group:

SUM(net_balance) = 0

This is mandatory.

---

# Settlement

1. Sender must be a group member.
2. Receiver must be a group member.
3. Sender and receiver cannot be the same.
4. Amount must be positive.
5. Settlement currency must match group currency.
6. Settlement must not create an unexplained imbalance.
7. Settlement must be recorded separately from expenses.

---

# Deletion

Expenses should be soft deleted.

Settlements should generally never be physically deleted.

If a settlement is incorrect:

create a reversal/correction transaction or mark it cancelled according to the financial audit policy.

---

# Editing Expenses

Editing an expense can affect all balances.

Therefore:

1. Record update.
2. Recalculate affected balances.
3. Validate total.
4. Validate participants.
5. Run balance invariant.
6. Commit atomically.

---

# Concurrency

Expense creation and settlement creation must use database transactions.

Two simultaneous settlement requests must not cause inconsistent balances.

Use:

database transaction
appropriate locking/isolation
idempotency keys where required

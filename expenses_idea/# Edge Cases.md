# Edge Cases

## 1. Three-way split with remainder

₹100 split among:

A
B
C

Expected:

A ₹34
B ₹33
C ₹33

Total = ₹100

---

# 2. User does not participate

Group:

A
B
C

Expense:

A pays ₹600

Participants:

A
B

Shares:

A ₹300
B ₹300

C owes ₹0.

---

# 3. Payer does not participate

Supported if product rules allow it.

Example:

A pays ₹1,000

Participants:

B
C

B ₹500
C ₹500

A receives ₹1,000.

This should be explicitly supported or rejected by product requirements.

Recommended:

Support it.

---

# 4. Partial settlement

Debt:

₹500

Payment:

₹200

Remaining:

₹300

---

# 5. Full settlement

Debt:

₹500

Payment:

₹500

Remaining:

₹0

---

# 6. Overpayment

Debt:

₹500

Settlement:

₹600

Recommended:

Reject unless the product explicitly supports overpayment.

---

# 7. Multiple expenses

A owes B:

Dinner ₹300
Taxi ₹200
Movie ₹100

Aggregate:

A → B ₹600

---

# 8. Opposite debts

A owes B ₹500.

B owes A ₹300.

Net:

A owes B ₹200.

The balance engine should not display both directions.

---

# 9. Circular debt

A owes B ₹100.
B owes C ₹100.
C owes A ₹100.

Net:

A = 0
B = 0
C = 0

No settlement required.

---

# 10. Member leaves group

Historical expenses remain.

The system must define whether future expenses can include the member.

Recommended:

A LEFT member cannot participate in new expenses.

---

# 11. Deleted expense

If an expense is deleted:

Recalculate balances.

Do not delete related financial history blindly.

---

# 12. Currency

For the first release:

One group = one currency.

Do not mix INR and USD inside the same group.

---

# 13. Decimal precision

Never:

amount = 33.33 floating point

Use:

amountPaise = 3333

---

# 14. Empty group

No expenses:

all balances = 0

---

# 15. Settlement after new expense

Example:

A owes B ₹300.

A settles ₹300.

Later:

B pays ₹600 for a new expense.

Balances must be recalculated including both events.

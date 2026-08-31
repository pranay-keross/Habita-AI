# Balance Calculation

## Goal

Calculate the current net balance for every member of a group.

---

# Meaning of Balance

Positive balance:

The user should RECEIVE money.

Negative balance:

The user should PAY money.

Zero:

The user has no outstanding balance.

---

# Core Formula

For each user:

net_balance =
    total_paid
    - total_share
    + settlements_received
    - settlements_paid

---

# Expense Contribution

If a user pays ₹1,000:

paid += 1000

If their own expense share is ₹300:

share += 300

Their expense balance:

1000 - 300 = +700

Therefore:

They should receive ₹700.

---

# Example

Group:

Pranay
Rahul
Amit

Expense:

Dinner
₹900

Paid by:

Pranay

Split equally:

Pranay ₹300
Rahul ₹300
Amit ₹300

Initial balances:

Pranay:

paid = 900
share = 300

balance = +600

Rahul:

paid = 0
share = 300

balance = -300

Amit:

paid = 0
share = 300

balance = -300

Result:

Pranay +₹600
Rahul -₹300
Amit -₹300

---

# Second Expense

Rahul pays ₹600 for a taxi.

Split:

Pranay ₹200
Rahul ₹200
Amit ₹200

Balances:

Pranay:

previous = +600
taxi = -200

new = +400

Rahul:

previous = -300
taxi = +400

new = +100

Amit:

previous = -300
taxi = -200

new = -500

Final:

Pranay +400
Rahul +100
Amit -500

Total:

400 + 100 - 500 = 0

---

# Critical Invariant

For every group:

SUM(all net balances) MUST equal zero.

Example:

+400
+100
-500

= 0

If the sum is not zero:

There is a calculation/data integrity error.

This should be checked in tests and optionally in development builds.

---

# Settlements

Settlements affect balances.

Example:

Rahul owes Pranay ₹300.

Rahul pays Pranay ₹200.

Settlement:

from = Rahul
to = Pranay
amount = ₹200

Update conceptually:

Rahul:

-300 + 200 = -100

Pranay:

+300 - 200 = +100

Remaining:

Rahul owes ₹100.

Pranay is owed ₹100.

---

# Settlement Formula

For each settlement:

from_user balance += settlement_amount

to_user balance -= settlement_amount

Why?

The sender has paid money and therefore owes less.

The receiver has received money and therefore is owed less.

---

# Recommended Implementation

Do not permanently store the calculated net balance as the source of truth.

Calculate it from:

expenses
expense_shares
settlements

A cached balance table may be introduced later for performance, but it must be treated as a derived/cache layer.

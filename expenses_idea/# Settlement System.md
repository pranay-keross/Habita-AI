# Settlement System

## Purpose

A settlement represents an actual transfer of money.

Example:

Rahul pays Pranay ₹300.

---

# Settlement Creation

Request:

from_user = Rahul
to_user = Pranay
amount = ₹300

Validation:

1. Both users must belong to the same group.
2. Amount must be greater than zero.
3. Sender cannot equal receiver.
4. Currency must match.
5. The settlement should not exceed the relevant outstanding amount unless the product intentionally supports overpayment.

---

# Partial Settlement

Example:

Rahul owes Pranay:

₹500

Rahul pays:

₹200

Remaining:

₹300

Settlement history:

Rahul → Pranay ₹200

Outstanding:

Rahul → Pranay ₹300

---

# Full Settlement

Rahul owes:

₹300

Rahul pays:

₹300

Remaining:

₹0

Relationship becomes settled.

---

# Settlement Does Not Delete Debt History

Never delete the original expense.

Never modify the expense amount.

Never modify the expense shares.

Create a settlement record.

---

# Settlement Status

Optional settlement status:

PENDING
COMPLETED
CANCELLED

For a simple internal ledger, COMPLETED can be created directly.

For external payment integrations:

PENDING → COMPLETED

or

PENDING → FAILED/CANCELLED

---

# Settlement History

Each settlement should remain visible.

Example:

Settlement History

28 Aug
Rahul paid Pranay ₹300

27 Aug
Amit paid Pranay ₹200

---

# Multiple Expense Settlement

If:

Rahul owes Pranay:

Dinner ₹300
Taxi ₹200
Movie ₹100

Total:

₹600

The user can settle:

Rahul → Pranay ₹600

The UI can show:

Settling 3 expenses

The underlying expenses remain separate.

Only one settlement transaction is created.

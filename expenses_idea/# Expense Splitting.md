# Expense Splitting

The application must support multiple split methods.

---

# Equal Split

Example:

Total = ₹1,000

Members:

A
B
C

Mathematically:

1000 / 3 = 333.333...

Money cannot contain fractions of a paisa.

Therefore:

A = ₹333.34
B = ₹333.33
C = ₹333.33

Total:

333.34 + 333.33 + 333.33 = ₹1,000.00

The remainder must always be distributed deterministically.

Never use floating point numbers for money.

Use integer minor units.

For INR:

₹100.50 = 10050 paise

---

# Exact Split

Example:

Total = ₹1,000

A = ₹500
B = ₹300
C = ₹200

Validation:

500 + 300 + 200 = 1000

If the values do not equal the expense total:

Reject the request.

---

# Percentage Split

Example:

Total = ₹1,000

A = 50%
B = 30%
C = 20%

Calculated:

A = ₹500
B = ₹300
C = ₹200

Validation:

Sum of percentages must equal exactly 100%.

---

# Shares Split

Example:

Total = ₹1,000

A = 2 shares
B = 1 share
C = 1 share

Total shares = 4

A = 1000 * 2 / 4 = ₹500
B = ₹250
C = ₹250

---

# Paid By

The expense must contain one or more payers.

Initial implementation can support:

single payer.

Example:

paid_by = Pranay

Future implementation may support:

multiple payers.

---

# Participants

Only selected group members can participate in an expense.

Example:

Group:

A
B
C
D

Expense participants:

A
B
C

D does not owe anything.

---

# Validation Rules

1. Expense amount must be greater than zero.
2. Expense must belong to an active group.
3. Payer must be a group member.
4. All participants must be group members.
5. At least one participant is required.
6. Split values must equal total amount.
7. Currency must match group currency.
8. Money must be stored as integer minor units.
9. Floating-point arithmetic must never be used.
10. Expense creation must be atomic.

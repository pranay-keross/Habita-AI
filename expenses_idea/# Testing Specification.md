# Testing Specification

The financial engine must have extensive unit tests.

---

# Balance Tests

## Test 1

A pays ₹900.

Split equally among A/B/C.

Expected:

A +600
B -300
C -300

---

## Test 2

A pays ₹100.

Split A/B/C.

Expected:

A +34
B -33
C -33

Total = 0

---

## Test 3

A pays ₹1,000.

B pays ₹500.

Split both expenses equally.

Verify final balances.

---

# Settlement Tests

## Test 4

A owes B ₹500.

Settlement A → B ₹200.

Expected:

A -300
B +300

---

## Test 5

A owes B ₹500.

Settlement A → B ₹500.

Expected:

A 0
B 0

---

# Simplification Tests

Input:

A +800
B +300
C -700
D -400

Expected:

C → A ₹700
D → B ₹300
D → A ₹100

---

# Circular Debt Test

A owes B ₹100.
B owes C ₹100.
C owes A ₹100.

Expected:

All balances = 0.

No settlement suggestions.

---

# Opposite Debt Test

A → B ₹500
B → A ₹300

Expected:

A → B ₹200

---

# Invariant Test

For every generated test case:

SUM(balances) == 0

---

# Property Tests

Generate random expenses.

For every generated group:

1. Every expense's shares sum to total.
2. Every group's balances sum to zero.
3. Every suggested settlement has amount > 0.
4. After applying all suggested settlements:
   all balances = 0.

---

# Idempotency

Creating the same expense request twice with the same idempotency key must not create two expenses.

---

# Regression Tests

Every production financial bug must become a permanent automated test.

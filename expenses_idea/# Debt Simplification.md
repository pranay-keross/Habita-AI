# Debt Simplification

## Purpose

Convert group net balances into a small number of settlement transactions.

Input:

Users with positive or negative balances.

Positive:

creditor

Negative:

debtor

---

# Example

Pranay +₹800
Rahul  -₹500
Amit   -₹300

Required settlements:

Rahul → Pranay ₹500
Amit → Pranay ₹300

---

# Greedy Algorithm

Use a greedy min-cash-flow algorithm.

Steps:

1. Calculate all net balances.
2. Remove users whose balance is zero.
3. Separate positive balances into creditors.
4. Separate negative balances into debtors.
5. Sort creditors by balance descending.
6. Sort debtors by absolute balance descending.
7. Match the largest debtor with the largest creditor.
8. Settlement amount = min(debtor amount, creditor amount).
9. Create a suggested transfer.
10. Reduce both balances.
11. Remove any user whose remaining balance is zero.
12. Continue until all balances are zero.

---

# Example

Balances:

A = +800
B = +300

C = -700
D = -400

Step 1:

Largest creditor:

A = +800

Largest debtor:

C = -700

Settlement:

C → A = ₹700

Remaining:

A = +100
B = +300
D = -400

Step 2:

Largest creditor:

B = +300

Largest debtor:

D = -400

Settlement:

D → B = ₹300

Remaining:

A = +100
D = -100

Step 3:

D → A = ₹100

Final:

C → A ₹700
D → B ₹300
D → A ₹100

All balances become zero.

---

# Important

This algorithm minimizes transactions in many practical cases and is simple and efficient.

It does NOT guarantee the mathematically minimum number of transactions for every possible balance configuration.

Finding the globally minimum number of transactions is a harder optimization problem.

For normal friend groups, the greedy algorithm is recommended.

---

# Complexity

If implemented using sorted arrays:

O(N log N)

If implemented with heaps:

O(N log N)

Where N = number of users with non-zero balances.

---

# Maximum Transactions

The greedy algorithm will require at most:

N - 1

settlement transactions.

---

# Pseudocode

function simplifyDebts(balances):

    creditors = []
    debtors = []

    for user, balance in balances:

        if balance > EPSILON:
            creditors.push({
                user: user,
                amount: balance
            })

        else if balance < -EPSILON:
            debtors.push({
                user: user,
                amount: abs(balance)
            })

    sort creditors descending by amount
    sort debtors descending by amount

    settlements = []

    i = 0
    j = 0

    while i < creditors.length
      and j < debtors.length:

        creditor = creditors[i]
        debtor = debtors[j]

        amount = min(
            creditor.amount,
            debtor.amount
        )

        settlements.push({
            from: debtor.user,
            to: creditor.user,
            amount: amount
        })

        creditor.amount -= amount
        debtor.amount -= amount

        if creditor.amount == 0:
            i++

        if debtor.amount == 0:
            j++

    return settlements

---

# Example Output

Input:

Pranay +800
Rahul +300
Amit -700
Suman -400

Output:

Amit → Pranay ₹700
Suman → Rahul ₹300
Suman → Pranay ₹100

---

# Important

Debt simplification is only a PRESENTATION/SETTLEMENT recommendation.

It must NOT modify:

expenses
expense_shares

The original expense ledger remains unchanged.

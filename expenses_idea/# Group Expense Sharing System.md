# Group Expense Sharing System

## Purpose

This module allows multiple users to create a group and track shared expenses.

Example:

A group contains:

- Pranay
- Rahul
- Amit
- Suman

Any member can create an expense.

Each expense contains:

- Description
- Total amount
- Who paid
- Who participated
- How the amount is split
- Date/time
- Optional note
- Optional receipt

The system calculates:

1. How much each person has paid
2. How much each person should actually bear
3. How much each person should receive
4. How much each person owes
5. Who should pay whom
6. Suggested settlement transactions
7. Settlement history

---

# Important Design Principle

Expenses and settlements are different concepts.

An expense answers:

> "Who paid for something and who consumed/shared it?"

A settlement answers:

> "Who actually transferred money to whom to clear an outstanding balance?"

Never modify an original expense when a settlement happens.

Example:

Expense:

Pranay paid ₹1,200 for dinner.

Split:

Pranay ₹300
Rahul ₹300
Amit ₹300
Suman ₹300

Later Rahul pays Pranay ₹300.

Do NOT modify the dinner expense.

Instead create:

Settlement:

Rahul → Pranay ₹300

The final balance is derived from both records.

---

# Source of Truth

The database source of truth consists of:

- Groups
- Group members
- Expenses
- Expense shares
- Settlements

Balances should preferably be DERIVED from these records rather than treated as independent financial truth.

This prevents balance drift.

---

# Core Concepts

## Expense

An expense represents money paid for goods/services.

Example:

Pranay pays ₹1,200 for dinner.

## Expense Share

An expense share represents how much a specific member is responsible for.

Example:

Pranay ₹300
Rahul ₹300
Amit ₹300
Suman ₹300

## Balance

Balance represents the member's net position.

Positive:

The member should receive money.

Negative:

The member needs to pay money.

Zero:

The member is settled.

## Settlement

A settlement represents an actual payment between two members.

Example:

Rahul pays Pranay ₹300.

---

# Required UI Concepts

The group balance page should expose:

## Owed by you

People that the current user needs to pay.

## Owed to you

People who need to pay the current user.

## Settled

People with whom the relevant outstanding relationship has been settled.

## Expenses

The complete expense history.

## Settle up

A suggested list of payments that clears outstanding balances.

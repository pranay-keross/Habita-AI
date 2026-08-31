# Frontend UI Specification

The UI should be mature, clean and information-focused.

Do not use emojis for financial status.

Do not use decorative emoji icons such as:

🌅
🌙
💰
🍔
🚕
🏠

Use a consistent icon library.

---

# Group Overview

Screen:

Group Details

Header:

Goa Trip
4 members

Primary summary:

Total expenses
₹18,450

Current user status:

You are owed ₹650

---

# Balance Summary

Use three logical sections.

## Owed by you

Example:

You owe

Rahul
₹200

Amit
₹150

Total:

₹350

---

## Owed to you

Example:

Rahul owes you
₹400

Suman owes you
₹250

Total:

₹650

---

## Settled

People with no remaining balance after settlement.

Example:

Amit
Settled

---

# Expense List

Each expense should display:

Description
Amount
Paid by
Date

Example:

Dinner
₹1,200
Paid by Rahul
29 Aug

---

# Expense Detail

Display:

Dinner

Total
₹1,200

Paid by
Rahul

Split between:

Rahul      ₹300
Pranay     ₹300
Amit       ₹300
Suman      ₹300

Optional note.

---

# Add Expense

Fields:

Description
Amount
Paid by
Split between
Split method
Note
Date

Split methods:

Equal
Exact
Percentage
Shares

---

# Settle Up

Show:

You owe

Rahul
₹250

You are owed

Amit
₹400

Then provide:

Settle up

---

# Smart Settlement

Optional:

Show recommended transfers.

Example:

Suggested settlement

Amit → Rahul
₹150

Amit → Pranay
₹250

This reduces the number of payments required.

---

# Design Requirements

Use:

- consistent spacing
- clear typography
- restrained colors
- strong hierarchy
- accessible contrast
- no unnecessary decoration
- no duplicate icons
- no emoji-based financial indicators

Financial meaning should come from labels, amounts and layout.

---

# Color Meaning

Positive balance:

Use the application's positive/success semantic color.

Negative balance:

Use warning/attention semantic color.

Settled:

Use neutral color.

Do not rely on color alone.

Always include text.

Example:

"Owes you ₹400"

not:

green "$400"

---

# Current User

Highlight the current user's balance.

Example:

Your balance
+₹650

You are owed ₹650

---

# Navigation

Group page:

Overview
Expenses
Balances
Activity

Primary action:

Add expense

Secondary action:

Settle up

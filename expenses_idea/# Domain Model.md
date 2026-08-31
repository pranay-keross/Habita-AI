# Domain Model

## Entities

The system contains the following primary entities:

User
Group
GroupMember
Expense
ExpenseShare
Settlement

---

# User

Represents an application user.

Fields:

id
name
email
phone
avatar_url
created_at
updated_at

---

# Group

Represents an expense-sharing group.

Example:

"Goa Trip"

Fields:

id
name
currency
created_by
created_at
updated_at
archived_at

---

# GroupMember

Connects a user to a group.

Fields:

id
group_id
user_id
joined_at
left_at
status

Possible status:

ACTIVE
LEFT
REMOVED

---

# Expense

Represents an original expense.

Fields:

id
group_id
description
total_amount
currency
paid_by
created_by
split_type
note
expense_date
created_at
updated_at
deleted_at

split_type:

EQUAL
EXACT
PERCENTAGE
SHARES

---

# ExpenseShare

Represents an individual's responsibility for an expense.

Fields:

id
expense_id
user_id
amount
percentage
shares

For an equal split:

Expense = ₹900

Pranay = ₹300
Rahul = ₹300
Amit = ₹300

---

# Settlement

Represents an actual payment between group members.

Fields:

id
group_id
from_user_id
to_user_id
amount
currency
note
settled_at
created_by
created_at

Example:

Rahul → Pranay ₹300

---

# Important

Settlement is NOT an expense.

Expense:

"Rahul paid ₹900 for dinner."

Settlement:

"Rahul paid Pranay ₹300 to clear a debt."

These must remain separate.

---

# Relationship

Group
|
+-- GroupMember
|
+-- Expense
|     |
|     +-- ExpenseShare
|
+-- Settlement

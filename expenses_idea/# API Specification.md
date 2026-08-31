# API Specification

Base URL:

/api/v1

---

# Groups

## Create Group

POST /groups

Request:

{
    "name": "Goa Trip",
    "currency": "INR"
}

Response:

{
    "id": "group-id",
    "name": "Goa Trip",
    "currency": "INR"
}

---

# Add Member

POST /groups/:groupId/members

Request:

{
    "userId": "user-id"
}

---

# Get Group

GET /groups/:groupId

Response:

{
    "id": "group-id",
    "name": "Goa Trip",
    "currency": "INR",
    "members": []
}

---

# Create Expense

POST /groups/:groupId/expenses

Request:

{
    "description": "Dinner",
    "amount": 120000,
    "currency": "INR",
    "paidBy": "user-1",
    "splitType": "EQUAL",
    "participants": [
        "user-1",
        "user-2",
        "user-3",
        "user-4"
    ],
    "note": "Dinner at ABC restaurant",
    "expenseDate": "2026-08-29T20:00:00Z"
}

IMPORTANT:

amount = 120000 means ₹1,200.00.

---

# Exact Split

{
    "description": "Hotel",
    "amount": 600000,
    "splitType": "EXACT",
    "paidBy": "user-1",
    "shares": [
        {
            "userId": "user-1",
            "amount": 150000
        },
        {
            "userId": "user-2",
            "amount": 150000
        },
        {
            "userId": "user-3",
            "amount": 150000
        },
        {
            "userId": "user-4",
            "amount": 150000
        }
    ]
}

---

# Percentage Split

{
    "amount": 100000,
    "splitType": "PERCENTAGE",
    "shares": [
        {
            "userId": "user-1",
            "percentage": 50
        },
        {
            "userId": "user-2",
            "percentage": 30
        },
        {
            "userId": "user-3",
            "percentage": 20
        }
    ]
}

---

# Get Group Balances

GET /groups/:groupId/balances

Response:

{
    "totalExpenses": 1845000,

    "members": [
        {
            "userId": "user-1",
            "balance": 65000
        },
        {
            "userId": "user-2",
            "balance": -25000
        },
        {
            "userId": "user-3",
            "balance": -40000
        }
    ]
}

Positive:

receives money

Negative:

owes money

---

# Get My Balance

GET /groups/:groupId/balances/me

Response:

{
    "balance": 65000,

    "owedToMe": [
        {
            "userId": "user-2",
            "amount": 40000
        },
        {
            "userId": "user-3",
            "amount": 25000
        }
    ],

    "owedByMe": []
}

---

# Get Settlement Suggestions

GET /groups/:groupId/settlements/suggestions

Response:

{
    "settlements": [
        {
            "from": "user-2",
            "to": "user-1",
            "amount": 40000
        },
        {
            "from": "user-3",
            "to": "user-1",
            "amount": 25000
        }
    ]
}

---

# Create Settlement

POST /groups/:groupId/settlements

Request:

{
    "fromUserId": "user-2",
    "toUserId": "user-1",
    "amount": 40000,
    "note": "Settled dinner and hotel"
}

---

# Get Settlements

GET /groups/:groupId/settlements

---

# Get Expenses

GET /groups/:groupId/expenses

Optional:

?page=1
&limit=20
&from=2026-08-01
&to=2026-08-31

---

# Delete Expense

DELETE /groups/:groupId/expenses/:expenseId

Recommended behavior:

Use soft deletion.

Do not physically delete financial records unless there is a strong reason.

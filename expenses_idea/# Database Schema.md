# Database Schema

Recommended database:

PostgreSQL

Money:

Use BIGINT.

For INR:

1 rupee = 100 paise

Never use FLOAT or DOUBLE for money.

---

# users

CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30),
    avatar_url TEXT,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

---

# groups

CREATE TABLE groups (
    id UUID PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'INR',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    archived_at TIMESTAMP NULL
);

---

# group_members

CREATE TABLE group_members (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES groups(id),
    user_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    joined_at TIMESTAMP NOT NULL,
    left_at TIMESTAMP NULL,

    UNIQUE(group_id, user_id)
);

---

# expenses

CREATE TABLE expenses (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES groups(id),
    description VARCHAR(255) NOT NULL,
    total_amount BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    paid_by UUID NOT NULL REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    split_type VARCHAR(20) NOT NULL,
    note TEXT,
    expense_date TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP NULL,

    CHECK(total_amount > 0)
);

---

# expense_shares

CREATE TABLE expense_shares (
    id UUID PRIMARY KEY,
    expense_id UUID NOT NULL REFERENCES expenses(id),
    user_id UUID NOT NULL REFERENCES users(id),
    amount BIGINT NOT NULL,
    percentage NUMERIC NULL,
    shares NUMERIC NULL,

    UNIQUE(expense_id, user_id),

    CHECK(amount >= 0)
);

---

# settlements

CREATE TABLE settlements (
    id UUID PRIMARY KEY,
    group_id UUID NOT NULL REFERENCES groups(id),
    from_user_id UUID NOT NULL REFERENCES users(id),
    to_user_id UUID NOT NULL REFERENCES users(id),
    amount BIGINT NOT NULL,
    currency CHAR(3) NOT NULL,
    note TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    settled_at TIMESTAMP NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP NOT NULL,

    CHECK(amount > 0),
    CHECK(from_user_id <> to_user_id)
);

---

# Recommended Indexes

CREATE INDEX idx_group_members_group
ON group_members(group_id);

CREATE INDEX idx_expenses_group
ON expenses(group_id);

CREATE INDEX idx_expense_shares_expense
ON expense_shares(expense_id);

CREATE INDEX idx_expense_shares_user
ON expense_shares(user_id);

CREATE INDEX idx_settlements_group
ON settlements(group_id);

CREATE INDEX idx_settlements_from
ON settlements(from_user_id);

CREATE INDEX idx_settlements_to
ON settlements(to_user_id);

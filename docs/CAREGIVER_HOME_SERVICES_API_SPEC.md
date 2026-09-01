# Habita AI — Caregiver & Home Services Backend API Specification & Requirements

> **Target Audience:** Backend Engineers & AI Agents building the Spring Boot 3.x / PostgreSQL backend for Habita AI.  
> **Module Reference:** SRS Module Group 3 (§7 "Caregiver & Home Services Hub") & API Ecosystem Summary (`/api/staff` & `/api/families/{familyId}/staff`).  
> **Flyway Schema Reference:** `V7__caregiver_and_home_services.sql`  
> **Frontend Consumers:**  
> - `src/features/staff/StaffScreen.tsx` (Caregiver profiles, attendance toggle, extra transactions, history sheet)  
> - `src/features/household/HouseholdOperationsScreen.tsx` (Household Operations hub & bento tiles)  
> - `src/features/household/HouseholdAreaScreen.tsx` (Caregiver domain workspace overview & metrics)  
> - `src/app/dashboard.tsx` (Dashboard home tile, daily attendance roll-call briefing & pending salary metrics)  
> - `src/features/staff/staffStore.ts` & `src/features/staff/types.ts`  

---

## 1. Executive Summary & Domain Scope

The **Caregiver & Home Services** module under **Household Operations** provides end-to-end management of household domestic staff (maids, cooks, drivers, housekeepers, security guards, gardeners) and specialized family caregivers (nannies, babysitters, eldercare attendants, patient care nurses, companion carers).

### Core Business Capabilities:
1. **Standardized Service Catalog & Custom Roles:** System-seeded standard catalog of household service roles (Housekeeping, Cooking, Childcare, Elderly care, Patient care, Driver, Security, etc.) with support for custom role titles.
2. **Staff Profile & Compensation Management:** Profiles with multi-currency support, flexible rate structures (**Monthly fixed salary** vs. **Hourly wage**), contact details, emergency contacts, joining dates, and shift timings.
3. **Daily Attendance & Shift Logging:** Fast, one-tap daily roll-call (`PRESENT`, `ABSENT`, `HALF_DAY`, `PAID_LEAVE`, `UNPAID_LEAVE`), rolling 30-day present count, and attendance calendar heatmap/history.
4. **Extra Payments & Financial Ledger:** Real-time ledger for cash advances, overtime pay, festival/performance bonuses, tips, and salary deductions with payment mode attribution (`UPI`, `CASH`, `BANK_TRANSFER`).
5. **Automated Monthly Payroll Calculation Engine:** Dynamic monthly wage calculator that prorates base pay according to attendance/unpaid leaves, calculates overtime, adds bonuses/tips, applies advance recoveries, and computes exact **Net Payable** amounts.
6. **Salary Settlement & Payout Receipts:** One-tap salary settlement recording with UPI deep-link generation, cash voucher stamps, and PDF/contractor audit summaries.
7. **Contractor & Annual Tax Summaries:** Aggregated annual wage and tip summaries for domestic contractor compliance and tax reporting.
8. **Multi-Tenant Family Isolation & RBAC:** Scoped to the `Family` context, allowing household owners and admins to manage staff, while regular family members can mark daily attendance and view service schedules.

---

## 2. Authentication, Authorization & Multi-Tenancy

- **Standard Header:** All requests require standard Bearer JWT token authentication:
  ```http
  Authorization: Bearer <accessToken>
  ```
- **User Identity Context:** Authenticated caller identity (`userId`, `phone`) is injected via `@CurrentUser User user` resolver.
- **Multi-Tenant Family Scoping:**
  - Caregivers/Staff belong to a specific `familyId`.
  - Every endpoint under `/api/families/{familyId}/staff/**` enforces `FamilyAccessService.checkFamilyMembership(user.getId(), familyId)`.
- **Role-Based Access Control (RBAC):**
  - **`OWNER` / `ADMIN`:** Full CRUD permissions (add staff, edit compensation, delete staff, record advances/bonuses, settle monthly salary, export tax summaries).
  - **`MEMBER`:** Read-only access to staff list, view schedules, and permission to mark daily attendance. Cannot modify compensation, delete staff, or settle payroll.
  - **Non-Members:** Return `401 Unauthorized` or `403 Forbidden` with `"You are not a member of this family"`.

---

## 3. Supported Enums, Data Types & Validation Rules

### 3.1 Rate Type (`CaregiverRateType`)
```typescript
type CaregiverRateType = 'MONTHLY' | 'HOURLY';
```
- `MONTHLY`: Fixed monthly compensation (e.g. ₹15,000 / month). Prorated in payroll engine based on working days and unpaid leaves.
- `HOURLY`: Hourly wage compensation (e.g. ₹150 / hour). Total wage computed from logged working hours.

### 3.2 Supported Currencies
```typescript
type Currency = 'INR' | 'USD' | 'EUR' | 'AED' | 'GBP';
```
- Default currency is **`INR`** (or inherited from Family default).

### 3.3 Attendance Status (`AttendanceStatus`)
```typescript
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'PAID_LEAVE' | 'UNPAID_LEAVE';
```
- `PRESENT`: Marked present for the workday (1.0 day weight).
- `ABSENT`: Unexcused absence (0.0 day weight; deducts from monthly prorated pay if monthly).
- `HALF_DAY`: Worked half shift (0.5 day weight).
- `PAID_LEAVE`: Excused paid time off (1.0 day weight; no salary deduction).
- `UNPAID_LEAVE`: Excused leave without pay (0.0 day weight; salary deducted).

### 3.4 Transaction Type (`CaregiverTransactionType`)
```typescript
type CaregiverTransactionType =
  | 'ADVANCE'          // Cash advance given to staff (creates receivable / balance to deduct)
  | 'OVERTIME'         // Additional pay for extra hours / holiday work
  | 'BONUS'            // Festival / festive bonus (e.g. Diwali, Eid, Christmas)
  | 'TIP'              // Gratuity / appreciation tip
  | 'DEDUCTION'        // Manual penalty or one-off deduction
  | 'SALARY_PAYMENT';  // Monthly salary settlement disbursement
```

### 3.5 Payment Method (`PaymentMethod`)
```typescript
type PaymentMethod = 'UPI' | 'CASH' | 'BANK_TRANSFER';
```

### 3.6 Staff Status (`StaffStatus`)
```typescript
type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED';
```

### 3.7 Standard Service Catalog
The backend provides a pre-seeded lookup catalog in table `staff_services`:
| ID | Service Name | Category | Default Rate Type |
|---|---|---|---|
| 1 | Housekeeping | Domestic | MONTHLY |
| 2 | Cooking | Domestic | MONTHLY |
| 3 | Childcare / nanny | Caregiving | MONTHLY |
| 4 | Elderly care | Caregiving | MONTHLY |
| 5 | Patient care | Caregiving | MONTHLY |
| 6 | Companion care | Caregiving | MONTHLY |
| 7 | Driver | Domestic | MONTHLY |
| 8 | Gardening | Maintenance | MONTHLY |
| 9 | Laundry | Domestic | MONTHLY |
| 10 | Security | Security | MONTHLY |
| 11 | Custom | General | MONTHLY |

---

## 4. REST API Endpoint Specifications

Base Paths:
- Public / Reference Catalog: `/api/staff/services`
- Family Scoped Operations: `/api/families/{familyId}/staff`

---

### 4.1 Service Catalog & Reference Lookups

#### `GET /api/staff/services`
Returns the master catalog of pre-seeded household staff and caregiver service categories.

- **Auth:** Bearer Token Required
- **Response (200 OK):**
```json
[
  {
    "id": 1,
    "serviceName": "Housekeeping",
    "category": "Domestic",
    "active": true
  },
  {
    "id": 2,
    "serviceName": "Cooking",
    "category": "Domestic",
    "active": true
  },
  {
    "id": 3,
    "serviceName": "Childcare / nanny",
    "category": "Caregiving",
    "active": true
  },
  {
    "id": 4,
    "serviceName": "Elderly care",
    "category": "Caregiving",
    "active": true
  },
  {
    "id": 5,
    "serviceName": "Patient care",
    "category": "Caregiving",
    "active": true
  },
  {
    "id": 6,
    "serviceName": "Companion care",
    "category": "Caregiving",
    "active": true
  },
  {
    "id": 7,
    "serviceName": "Driver",
    "category": "Domestic",
    "active": true
  },
  {
    "id": 8,
    "serviceName": "Gardening",
    "category": "Maintenance",
    "active": true
  },
  {
    "id": 9,
    "serviceName": "Laundry",
    "category": "Domestic",
    "active": true
  },
  {
    "id": 10,
    "serviceName": "Security",
    "category": "Security",
    "active": true
  },
  {
    "id": 11,
    "serviceName": "Custom",
    "category": "General",
    "active": true
  }
]
```

---

### 4.2 Staff Profiles & Lifecycle Management

#### `POST /api/families/{familyId}/staff`
Creates and registers a new caregiver or domestic staff member for the specified family.

- **Auth:** Bearer Token (`OWNER` or `ADMIN` of family)
- **Path Parameter:**
  - `familyId` (UUID, required): Target family UUID.
- **Request Body (JSON):**
```json
{
  "name": "Ramesh Kumar",
  "serviceId": 7,
  "customRole": null,
  "rateType": "MONTHLY",
  "rate": 15000.00,
  "currency": "INR",
  "phone": "9876543210",
  "emergencyContactName": "Sunita Kumar",
  "emergencyContactPhone": "9876543211",
  "joiningDate": "2026-08-01",
  "shiftStartTime": "08:00",
  "shiftEndTime": "17:00",
  "workingDaysPerWeek": 6,
  "notes": "Experienced driver, knows South Delhi routes. Cleans the car daily."
}
```

- **Validation Rules:**
  - `name`: Mandatory, 2–100 characters.
  - `serviceId`: Mandatory. If `serviceId == 11` (Custom), `customRole` is mandatory (2–50 characters).
  - `rateType`: `MONTHLY` or `HOURLY` (defaults to `MONTHLY`).
  - `rate`: Non-negative decimal number (`>= 0.00`).
  - `currency`: Valid ISO code (`INR`, `USD`, `EUR`, `AED`, `GBP`), defaults to `INR`.
  - `phone`: Optional. If present, 10-digit Indian number or E.164.
  - `joiningDate`: Mandatory `YYYY-MM-DD`. Defaults to current date if omitted.
  - `workingDaysPerWeek`: Integer between 1 and 7 (defaults to 6).

- **Response (201 Created):**
```json
{
  "id": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
  "familyId": "1e10adce-49ea-489c-8ac1-aefa4bcbc275",
  "name": "Ramesh Kumar",
  "serviceId": 7,
  "serviceName": "Driver",
  "role": "Driver",
  "customRole": null,
  "rateType": "MONTHLY",
  "rate": 15000.00,
  "currency": "INR",
  "phone": "9876543210",
  "emergencyContactName": "Sunita Kumar",
  "emergencyContactPhone": "9876543211",
  "joiningDate": "2026-08-01",
  "shiftStartTime": "08:00",
  "shiftEndTime": "17:00",
  "workingDaysPerWeek": 6,
  "notes": "Experienced driver, knows South Delhi routes. Cleans the car daily.",
  "status": "ACTIVE",
  "active": true,
  "createdAt": "2026-08-31T14:30:00.000Z",
  "updatedAt": "2026-08-31T14:30:00.000Z"
}
```

---

#### `GET /api/families/{familyId}/staff`
Retrieves a paginated list of staff members for the family with optional filtering and search.

- **Auth:** Bearer Token (Any family member)
- **Path Parameter:** `familyId` (UUID, required)
- **Query Parameters:**
  - `page` (integer, optional, default: `0`): 0-indexed page number.
  - `size` (integer, optional, default: `10`): Number of items per page.
  - `active` (boolean, optional): Filter by active status (`true` | `false`).
  - `search` (string, optional): Fuzzy search by staff name or role.
  - `serviceId` (integer, optional): Filter by specific service category.
- **Response (200 OK):**
```json
{
  "content": [
    {
      "id": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
      "familyId": "1e10adce-49ea-489c-8ac1-aefa4bcbc275",
      "name": "Ramesh Kumar",
      "serviceId": 7,
      "serviceName": "Driver",
      "role": "Driver",
      "customRole": null,
      "rateType": "MONTHLY",
      "rate": 15000.00,
      "currency": "INR",
      "phone": "9876543210",
      "emergencyContactName": "Sunita Kumar",
      "emergencyContactPhone": "9876543211",
      "joiningDate": "2026-08-01",
      "shiftStartTime": "08:00",
      "shiftEndTime": "17:00",
      "workingDaysPerWeek": 6,
      "notes": "Experienced driver, knows South Delhi routes.",
      "status": "ACTIVE",
      "active": true,
      "todaysAttendance": "PRESENT",
      "monthlyPresentDays": 24,
      "outstandingAdvance": 2000.00,
      "createdAt": "2026-08-01T09:00:00.000Z",
      "updatedAt": "2026-08-31T14:30:00.000Z"
    },
    {
      "id": "284913ed-5441-4dd0-95e1-62897d3ec4aa",
      "familyId": "1e10adce-49ea-489c-8ac1-aefa4bcbc275",
      "name": "Sunita Devi",
      "serviceId": 2,
      "serviceName": "Cooking",
      "role": "Cooking",
      "customRole": null,
      "rateType": "MONTHLY",
      "rate": 8000.00,
      "currency": "INR",
      "phone": "9876500011",
      "emergencyContactName": null,
      "emergencyContactPhone": null,
      "joiningDate": "2026-08-10",
      "shiftStartTime": "07:30",
      "shiftEndTime": "11:30",
      "workingDaysPerWeek": 7,
      "notes": "Prepares morning breakfast and lunch.",
      "status": "ACTIVE",
      "active": true,
      "todaysAttendance": null,
      "monthlyPresentDays": 20,
      "outstandingAdvance": 0.00,
      "createdAt": "2026-08-10T10:00:00.000Z",
      "updatedAt": "2026-08-10T10:00:00.000Z"
    }
  ],
  "pageable": {
    "pageNumber": 0,
    "pageSize": 10,
    "offset": 0,
    "paged": true,
    "unpaged": false
  },
  "totalElements": 2,
  "totalPages": 1,
  "last": true,
  "first": true,
  "size": 10,
  "number": 0,
  "numberOfElements": 2,
  "empty": false
}
```

---

#### `GET /api/families/{familyId}/staff/{staffId}`
Fetches full profile, current month's attendance rollup, recent transactions, and compensation details for a single staff member.

- **Auth:** Bearer Token (Any family member)
- **Response (200 OK):**
```json
{
  "id": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
  "familyId": "1e10adce-49ea-489c-8ac1-aefa4bcbc275",
  "name": "Ramesh Kumar",
  "serviceId": 7,
  "serviceName": "Driver",
  "role": "Driver",
  "customRole": null,
  "rateType": "MONTHLY",
  "rate": 15000.00,
  "currency": "INR",
  "phone": "9876543210",
  "emergencyContactName": "Sunita Kumar",
  "emergencyContactPhone": "9876543211",
  "joiningDate": "2026-08-01",
  "shiftStartTime": "08:00",
  "shiftEndTime": "17:00",
  "workingDaysPerWeek": 6,
  "notes": "Experienced driver, knows South Delhi routes. Cleans the car daily.",
  "status": "ACTIVE",
  "active": true,
  "currentMonthStats": {
    "month": "2026-08",
    "presentDays": 24,
    "absentDays": 2,
    "leaveDays": 1,
    "halfDays": 1,
    "totalWorkingDays": 27,
    "adherenceRate": 92.5
  },
  "financialOverview": {
    "baseRate": 15000.00,
    "totalAdvancesGiven": 2000.00,
    "totalAdvancesRecovered": 0.00,
    "outstandingAdvance": 2000.00,
    "overtimeEarned": 600.00,
    "bonusEarned": 500.00,
    "tipsEarned": 200.00,
    "estimatedNetPayable": 14100.00
  },
  "recentTransactions": [
    {
      "id": "txn-001",
      "type": "ADVANCE",
      "amount": 2000.00,
      "reason": "Emergency medical expenses for son",
      "paymentMethod": "CASH",
      "transactionDate": "2026-08-15",
      "createdAt": "2026-08-15T11:00:00.000Z"
    },
    {
      "id": "txn-002",
      "type": "OVERTIME",
      "amount": 600.00,
      "reason": "Late night airport pickup",
      "paymentMethod": "UPI",
      "transactionDate": "2026-08-20",
      "createdAt": "2026-08-20T23:30:00.000Z"
    }
  ],
  "createdAt": "2026-08-01T09:00:00.000Z",
  "updatedAt": "2026-08-31T14:30:00.000Z"
}
```

---

#### `PUT /api/families/{familyId}/staff/{staffId}`
Updates caregiver profile details, compensation rates, shift timings, or contact information.

- **Auth:** Bearer Token (`OWNER` or `ADMIN`)
- **Request Body (JSON):**
```json
{
  "name": "Ramesh Kumar",
  "serviceId": 7,
  "customRole": "Senior Family Driver",
  "rateType": "MONTHLY",
  "rate": 16000.00,
  "currency": "INR",
  "phone": "9876543210",
  "emergencyContactName": "Sunita Kumar",
  "emergencyContactPhone": "9876543211",
  "joiningDate": "2026-08-01",
  "shiftStartTime": "08:00",
  "shiftEndTime": "18:00",
  "workingDaysPerWeek": 6,
  "notes": "Promoted to Senior Driver. Handles outstation trips as well."
}
```

- **Response (200 OK):** Returns updated staff object.

---

#### `PATCH /api/families/{familyId}/staff/{staffId}/status`
Quick endpoint to toggle staff status (`ACTIVE`, `INACTIVE`, `TERMINATED`).

- **Auth:** Bearer Token (`OWNER` or `ADMIN`)
- **Request Body (JSON):**
```json
{
  "status": "INACTIVE",
  "terminationDate": null,
  "reason": "On extended leave for harvest season"
}
```
- **Response (200 OK):**
```json
{
  "id": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
  "status": "INACTIVE",
  "active": false,
  "updatedAt": "2026-08-31T15:00:00.000Z"
}
```

---

#### `DELETE /api/families/{familyId}/staff/{staffId}`
Removes or soft-deletes a caregiver profile.

- **Auth:** Bearer Token (`OWNER` or `ADMIN`)
- **Precondition Check:**
  - If the staff member has an unrecovered cash advance (`outstandingAdvance > 0`), the backend returns `400 Bad Request` with error code `STAFF_OUTSTANDING_ADVANCE_EXISTS` unless the query parameter `?force=true` is supplied.
- **Response (204 No Content)** on success.

---

### 4.3 Daily Attendance & Roll-Call Engine

#### `POST /api/families/{familyId}/staff/{staffId}/attendance`
Marks or updates attendance for a specific staff member on a specific calendar date (`YYYY-MM-DD`).

- **Auth:** Bearer Token (Any family member)
- **Request Body (JSON):**
```json
{
  "date": "2026-08-31",
  "status": "PRESENT",
  "checkInTime": "08:15",
  "checkOutTime": "17:30",
  "workingHours": 9.25,
  "notes": "Arrived on time"
}
```
- **Idempotency & Toggle Behavior:**
  - If an attendance record for that staff member and date already exists with the same status, calling this endpoint toggles/clears the record back to unmarked (`204 No Content` / deleted), matching mobile UX expectations.
  - If the record exists with a different status, it updates the record to the new status.

- **Response (200 OK):**
```json
{
  "id": "att-f73e7e2b-2026-08-31",
  "staffId": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
  "date": "2026-08-31",
  "status": "PRESENT",
  "checkInTime": "08:15",
  "checkOutTime": "17:30",
  "workingHours": 9.25,
  "notes": "Arrived on time",
  "markedByUserId": "usr-12345",
  "markedAt": "2026-08-31T08:15:30.000Z"
}
```

---

#### `GET /api/families/{familyId}/staff/{staffId}/attendance`
Retrieves attendance records for a specific caregiver over a date range or calendar month.

- **Auth:** Bearer Token (Any family member)
- **Query Parameters:**
  - `month` (string, optional, format: `YYYY-MM`, e.g. `2026-08`): Fetches all days for the specified month.
  - `startDate` (string, optional, format: `YYYY-MM-DD`): Range start.
  - `endDate` (string, optional, format: `YYYY-MM-DD`): Range end.
  - `limit` (integer, optional, default: `30`): Max records returned.

- **Response (200 OK):**
```json
{
  "staffId": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
  "month": "2026-08",
  "summary": {
    "presentCount": 24,
    "absentCount": 2,
    "leaveCount": 1,
    "halfDayCount": 1,
    "totalLoggedDays": 28,
    "effectiveWorkedDays": 24.5
  },
  "records": [
    {
      "id": "att-001",
      "date": "2026-08-31",
      "status": "PRESENT",
      "workingHours": 9.0,
      "markedAt": "2026-08-31T08:00:00.000Z"
    },
    {
      "id": "att-002",
      "date": "2026-08-30",
      "status": "PRESENT",
      "workingHours": 8.5,
      "markedAt": "2026-08-30T08:05:00.000Z"
    },
    {
      "id": "att-003",
      "date": "2026-08-29",
      "status": "LEAVE",
      "workingHours": 0.0,
      "notes": "Approved personal leave",
      "markedAt": "2026-08-29T07:30:00.000Z"
    }
  ]
}
```

---

#### `POST /api/families/{familyId}/staff/attendance/bulk-daily`
Allows marking attendance for all or multiple household staff members at once (e.g. from the morning dashboard roll-call widget).

- **Auth:** Bearer Token (Any family member)
- **Request Body (JSON):**
```json
{
  "date": "2026-08-31",
  "entries": [
    {
      "staffId": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
      "status": "PRESENT"
    },
    {
      "staffId": "284913ed-5441-4dd0-95e1-62897d3ec4aa",
      "status": "PRESENT"
    },
    {
      "staffId": "c1f676b2-9e3a-4de3-b8b4-09d6bd3490a0",
      "status": "ABSENT"
    }
  ]
}
```
- **Response (200 OK):**
```json
{
  "date": "2026-08-31",
  "processedCount": 3,
  "results": [
    {
      "staffId": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
      "status": "PRESENT",
      "updated": true
    },
    {
      "staffId": "284913ed-5441-4dd0-95e1-62897d3ec4aa",
      "status": "PRESENT",
      "updated": true
    },
    {
      "staffId": "c1f676b2-9e3a-4de3-b8b4-09d6bd3490a0",
      "status": "ABSENT",
      "updated": true
    }
  ]
}
```

---

#### `GET /api/families/{familyId}/staff/attendance/daily-summary`
Returns the status of all household staff for a given calendar day (defaults to today).

- **Auth:** Bearer Token (Any family member)
- **Query Parameter:** `date` (string, optional, format: `YYYY-MM-DD`, default: today)
- **Response (200 OK):**
```json
{
  "date": "2026-08-31",
  "totalActiveStaff": 3,
  "presentCount": 2,
  "absentCount": 1,
  "leaveCount": 0,
  "unmarkedCount": 0,
  "staff": [
    {
      "staffId": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
      "name": "Ramesh Kumar",
      "role": "Driver",
      "status": "PRESENT"
    },
    {
      "staffId": "284913ed-5441-4dd0-95e1-62897d3ec4aa",
      "name": "Sunita Devi",
      "role": "Cook",
      "status": "PRESENT"
    },
    {
      "staffId": "c1f676b2-9e3a-4de3-b8b4-09d6bd3490a0",
      "name": "Mohan Lal",
      "role": "Security",
      "status": "ABSENT"
    }
  ]
}
```

---

### 4.4 Financial Ledger, Advances, Overtime & Bonuses

#### `POST /api/families/{familyId}/staff/{staffId}/transactions`
Records a financial transaction (cash advance, overtime pay, festival bonus, tip, or manual penalty deduction).

- **Auth:** Bearer Token (`OWNER` or `ADMIN`)
- **Request Body (JSON):**
```json
{
  "type": "ADVANCE",
  "amount": 2000.00,
  "currency": "INR",
  "reason": "Emergency medical treatment",
  "paymentMethod": "CASH",
  "transactionDate": "2026-08-15",
  "repaymentMonth": "2026-08",
  "notes": "To be deducted from August monthly salary"
}
```

- **Validation Rules:**
  - `type`: `ADVANCE` | `OVERTIME` | `BONUS` | `TIP` | `DEDUCTION` | `SALARY_PAYMENT`
  - `amount`: Strictly positive number (`> 0.00`).
  - `currency`: Valid currency code, defaults to `INR`.
  - `paymentMethod`: `UPI` | `CASH` | `BANK_TRANSFER` (defaults to `CASH`).
  - `transactionDate`: `YYYY-MM-DD` (defaults to current date).

- **Response (201 Created):**
```json
{
  "id": "txn-550e8400-e29b-41d4-a716-446655440000",
  "familyId": "1e10adce-49ea-489c-8ac1-aefa4bcbc275",
  "staffId": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
  "type": "ADVANCE",
  "amount": 2000.00,
  "currency": "INR",
  "reason": "Emergency medical treatment",
  "paymentMethod": "CASH",
  "transactionDate": "2026-08-15",
  "repaymentMonth": "2026-08",
  "notes": "To be deducted from August monthly salary",
  "settledInPayrollId": null,
  "createdAt": "2026-08-15T11:00:00.000Z"
}
```

---

#### `GET /api/families/{familyId}/staff/{staffId}/transactions`
Lists transactions for a staff member with pagination and filtering.

- **Auth:** Bearer Token (Any family member)
- **Query Parameters:**
  - `page` (integer, default: `0`)
  - `size` (integer, default: `20`)
  - `type` (string, optional): Filter by `ADVANCE`, `OVERTIME`, `BONUS`, `TIP`, `DEDUCTION`, `SALARY_PAYMENT`.
  - `month` (string, optional, format: `YYYY-MM`): Filter by transaction month.
- **Response (200 OK):**
```json
{
  "content": [
    {
      "id": "txn-550e8400-e29b-41d4-a716-446655440000",
      "staffId": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
      "type": "ADVANCE",
      "amount": 2000.00,
      "currency": "INR",
      "reason": "Emergency medical treatment",
      "paymentMethod": "CASH",
      "transactionDate": "2026-08-15",
      "createdAt": "2026-08-15T11:00:00.000Z"
    },
    {
      "id": "txn-660e8400-e29b-41d4-a716-446655440001",
      "staffId": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
      "type": "OVERTIME",
      "amount": 600.00,
      "currency": "INR",
      "reason": "Late night airport duty",
      "paymentMethod": "UPI",
      "transactionDate": "2026-08-20",
      "createdAt": "2026-08-20T23:30:00.000Z"
    }
  ],
  "totalElements": 2,
  "totalPages": 1,
  "size": 20,
  "number": 0
}
```

---

#### `DELETE /api/families/{familyId}/staff/{staffId}/transactions/{transactionId}`
Cancels / deletes an unsettled transaction.

- **Auth:** Bearer Token (`OWNER` or `ADMIN`)
- **Precondition:** Cannot delete a transaction that has already been linked to a locked/settled monthly payroll run.
- **Response (204 No Content)** on success.

---

### 4.5 Payroll Engine & Monthly Wage Settlement

#### `GET /api/families/{familyId}/staff/{staffId}/payroll/summary`
Calculates and previews the itemized monthly payroll breakdown for a given calendar month.

- **Auth:** Bearer Token (`OWNER` or `ADMIN`)
- **Query Parameter:** `month` (string, required, format: `YYYY-MM`, e.g. `2026-08`)
- **Calculation Logic Executed:**
  - Base monthly salary or hourly wage accumulator.
  - Working days count vs. total days in month.
  - Unpaid absences & leave deduction.
  - Overtime pay accumulator.
  - Bonuses & tips accumulator.
  - Outstanding advances to recover.
  - Final calculated **`netPayableAmount`**.
- **Response (200 OK):**
```json
{
  "staffId": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
  "staffName": "Ramesh Kumar",
  "role": "Driver",
  "month": "2026-08",
  "currency": "INR",
  "rateType": "MONTHLY",
  "baseRate": 15000.00,
  "attendance": {
    "daysInMonth": 31,
    "scheduledWorkingDays": 27,
    "presentDays": 24,
    "halfDays": 1,
    "paidLeaves": 1,
    "unpaidAbsences": 1,
    "effectiveWorkedDays": 25.5
  },
  "earnings": {
    "basePay": 15000.00,
    "proratedBasePay": 14166.67,
    "unpaidAbsenceDeduction": 833.33,
    "overtimePay": 600.00,
    "bonuses": 500.00,
    "tips": 200.00,
    "grossEarnings": 15466.67
  },
  "deductions": {
    "advanceRecovery": 2000.00,
    "otherDeductions": 0.00,
    "totalDeductions": 2000.00
  },
  "netPayableAmount": 13466.67,
  "settlementStatus": "UNPAID",
  "settledAt": null,
  "settlementPaymentMethod": null
}
```

---

#### `POST /api/families/{familyId}/staff/{staffId}/payroll/settle`
Finalizes and settles the monthly salary for a caregiver, records the payment transaction, and generates payment receipt metadata.

- **Auth:** Bearer Token (`OWNER` or `ADMIN`)
- **Request Body (JSON):**
```json
{
  "month": "2026-08",
  "finalAmount": 13466.67,
  "currency": "INR",
  "paymentMethod": "UPI",
  "advanceDeducted": 2000.00,
  "paymentReference": "UPI/CR/20260831123456",
  "paymentDate": "2026-08-31",
  "notes": "August 2026 salary settled via PhonePe UPI"
}
```

- **Response (200 OK):**
```json
{
  "settlementId": "stl-990e8400-e29b-41d4-a716-446655440099",
  "familyId": "1e10adce-49ea-489c-8ac1-aefa4bcbc275",
  "staffId": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
  "month": "2026-08",
  "grossAmount": 15466.67,
  "deductionsAmount": 2000.00,
  "netPaidAmount": 13466.67,
  "currency": "INR",
  "paymentMethod": "UPI",
  "paymentReference": "UPI/CR/20260831123456",
  "paymentDate": "2026-08-31",
  "status": "SETTLED",
  "transactionId": "txn-salary-202608-f73e",
  "createdAt": "2026-08-31T16:00:00.000Z"
}
```

---

#### `GET /api/families/{familyId}/staff/payroll/monthly-overview`
Overview of total payroll liabilities, amounts paid, and pending payouts across all household staff for a month.

- **Auth:** Bearer Token (`OWNER` or `ADMIN`)
- **Query Parameter:** `month` (string, required, format: `YYYY-MM`)
- **Response (200 OK):**
```json
{
  "familyId": "1e10adce-49ea-489c-8ac1-aefa4bcbc275",
  "month": "2026-08",
  "currency": "INR",
  "totalStaffCount": 3,
  "totalPayrollLiability": 38000.00,
  "totalAdvancesGiven": 3500.00,
  "totalPaidSoFar": 13466.67,
  "totalPendingPayout": 21500.00,
  "staffBreakdown": [
    {
      "staffId": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
      "name": "Ramesh Kumar",
      "role": "Driver",
      "netPayable": 13466.67,
      "status": "SETTLED"
    },
    {
      "staffId": "284913ed-5441-4dd0-95e1-62897d3ec4aa",
      "name": "Sunita Devi",
      "role": "Cook",
      "netPayable": 8000.00,
      "status": "PENDING"
    },
    {
      "staffId": "c1f676b2-9e3a-4de3-b8b4-09d6bd3490a0",
      "name": "Mohan Lal",
      "role": "Security",
      "netPayable": 13500.00,
      "status": "PENDING"
    }
  ]
}
```

---

### 4.6 Dashboard & Contractor Tax Reporting

#### `GET /api/families/{familyId}/staff/dashboard-summary`
Aggregated metrics consumed by the main Home Dashboard and Household Operations bento grid.

- **Auth:** Bearer Token (Any family member)
- **Response (200 OK):**
```json
{
  "activeStaffCount": 3,
  "todayAttendance": {
    "date": "2026-08-31",
    "presentCount": 2,
    "absentCount": 1,
    "leaveCount": 0,
    "unmarkedCount": 0,
    "allMarked": true
  },
  "currentMonthPayroll": {
    "month": "2026-08",
    "totalPayrollLiability": 38000.00,
    "totalAdvancesPending": 1500.00,
    "settledCount": 1,
    "pendingCount": 2
  },
  "quickActions": [
    "MARK_DAILY_ATTENDANCE",
    "RECORD_ADVANCE_OR_EXTRA",
    "SETTLE_SALARY"
  ]
}
```

---

#### `GET /api/families/{familyId}/staff/tax-summary`
Generates annual contractor summary per caregiver for household accounting and tax compliance.

- **Auth:** Bearer Token (`OWNER` or `ADMIN`)
- **Query Parameter:** `year` (integer, required, e.g. `2026`)
- **Response (200 OK):**
```json
{
  "familyId": "1e10adce-49ea-489c-8ac1-aefa4bcbc275",
  "taxYear": 2026,
  "currency": "INR",
  "totalPaidAllStaff": 248000.00,
  "contractors": [
    {
      "staffId": "f73e7e2b-3c2b-4ee0-ba84-5d77fac7a830",
      "name": "Ramesh Kumar",
      "role": "Driver",
      "phone": "9876543210",
      "totalGrossSalaryPaid": 120000.00,
      "totalOvertimePaid": 4800.00,
      "totalBonusesPaid": 5000.00,
      "totalTipsPaid": 1200.00,
      "totalAdvancesRecovered": 10000.00,
      "netDisbursed": 121000.00,
      "monthsActive": 8
    }
  ]
}
```

---

## 5. Payroll, Attendance & Financial Calculation Rules

### 5.1 Rolling 30-Day Present Days Count
- **Definition:** The total count of days where `status == 'PRESENT'` within the last 30 calendar days (`[today - 29 days, today]`).
- Formula:
  $$\text{PresentDays}_{30d} = \sum_{d = \text{today}-29}^{\text{today}} \begin{cases} 1 & \text{if } \text{status}(d) = \text{PRESENT} \\ 0.5 & \text{if } \text{status}(d) = \text{HALF\_DAY} \\ 0 & \text{otherwise} \end{cases}$$

### 5.2 Monthly Salary Proration (Fixed Monthly Rate)
For staff on `rateType = 'MONTHLY'`:
1. **Total Days in Month ($D_m$):** 28, 29, 30, or 31 depending on calendar month.
2. **Scheduled Working Days ($W_s$):** Total calendar days minus configured rest days (e.g. Sundays if 6 days/week).
3. **Daily Base Rate ($R_d$):**
   $$R_d = \frac{\text{Base Monthly Rate}}{D_m} \quad \text{or} \quad \frac{\text{Base Monthly Rate}}{W_s} \text{ (based on contract)}$$
   *Default platform standard:* $R_d = \frac{\text{Base Monthly Rate}}{D_m}$.
4. **Unpaid Deduction:**
   $$\text{Deduction}_{\text{absent}} = (\text{Unpaid Absences} + 0.5 \times \text{Half Days}) \times R_d$$
5. **Gross Monthly Earnings:**
   $$\text{Gross Earnings} = \text{Base Rate} - \text{Deduction}_{\text{absent}} + \text{Overtime} + \text{Bonuses} + \text{Tips}$$
6. **Net Payable Amount:**
   $$\text{Net Payable} = \text{Gross Earnings} - \text{Advance Recovery} - \text{Other Deductions}$$

### 5.3 Advance Recovery Guardrail
- Advance deductions cannot exceed the staff member's net earnings for that pay period without explicit admin override.
- Unrecovered advances carry over automatically to the subsequent month's `outstandingAdvance`.

---

## 6. TypeScript Frontend Contract & Interfaces

```typescript
// Location: src/features/staff/types.ts

export type CaregiverRateType = 'MONTHLY' | 'HOURLY';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'PAID_LEAVE' | 'UNPAID_LEAVE';
export type CaregiverTransactionType = 'ADVANCE' | 'OVERTIME' | 'BONUS' | 'TIP' | 'DEDUCTION' | 'SALARY_PAYMENT';
export type PaymentMethod = 'UPI' | 'CASH' | 'BANK_TRANSFER';
export type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED';

export interface Caregiver {
  id: string;
  familyId: string;
  name: string;
  serviceId?: number;
  serviceName: string;
  role: string;
  customRole?: string | null;
  rateType: CaregiverRateType;
  rate: number;
  currency: string;
  phone?: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  joiningDate: string; // "YYYY-MM-DD"
  shiftStartTime?: string; // "HH:mm"
  shiftEndTime?: string;   // "HH:mm"
  workingDaysPerWeek?: number;
  notes?: string;
  status: StaffStatus;
  active: boolean;
  todaysAttendance?: AttendanceStatus | null;
  monthlyPresentDays?: number;
  outstandingAdvance?: number;
  createdAt: number | string;
  updatedAt?: number | string;
}

export interface AttendanceEntry {
  id: string;
  staffId: string;
  date: string; // "YYYY-MM-DD"
  status: AttendanceStatus;
  workingHours?: number;
  notes?: string;
  markedAt: number | string;
}

export interface CaregiverTransaction {
  id: string;
  staffId: string;
  type: CaregiverTransactionType;
  amount: number;
  currency: string;
  reason: string;
  paymentMethod: PaymentMethod;
  transactionDate: string; // "YYYY-MM-DD"
  createdAt: number | string;
}

export interface MonthlyPayrollSummary {
  staffId: string;
  staffName: string;
  role: string;
  month: string; // "YYYY-MM"
  currency: string;
  rateType: CaregiverRateType;
  baseRate: number;
  attendance: {
    daysInMonth: number;
    scheduledWorkingDays: number;
    presentDays: number;
    halfDays: number;
    paidLeaves: number;
    unpaidAbsences: number;
    effectiveWorkedDays: number;
  };
  earnings: {
    basePay: number;
    proratedBasePay: number;
    unpaidAbsenceDeduction: number;
    overtimePay: number;
    bonuses: number;
    tips: number;
    grossEarnings: number;
  };
  deductions: {
    advanceRecovery: number;
    otherDeductions: number;
    totalDeductions: number;
  };
  netPayableAmount: number;
  settlementStatus: 'UNPAID' | 'SETTLED';
  settledAt?: string | null;
  settlementPaymentMethod?: PaymentMethod | null;
}

export interface StaffDashboardSummary {
  activeStaffCount: number;
  todayAttendance: {
    date: string;
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    unmarkedCount: number;
    allMarked: boolean;
  };
  currentMonthPayroll: {
    month: string;
    totalPayrollLiability: number;
    totalAdvancesPending: number;
    settledCount: number;
    pendingCount: number;
  };
}
```

---

## 7. Database Migration & Flyway DDL (`V7__caregiver_and_home_services.sql`)

```sql
-- ============================================================================
-- Flyway Migration: V7__caregiver_and_home_services.sql
-- Description: Caregiver, Domestic Staff, Attendance, Financial Ledger & Payroll
-- PostgreSQL 16+ Compliant
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Reference Services Catalog
CREATE TABLE IF NOT EXISTS staff_services (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL DEFAULT 'Domestic',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO staff_services (id, service_name, category, active) VALUES
    (1, 'Housekeeping', 'Domestic', TRUE),
    (2, 'Cooking', 'Domestic', TRUE),
    (3, 'Childcare / nanny', 'Caregiving', TRUE),
    (4, 'Elderly care', 'Caregiving', TRUE),
    (5, 'Patient care', 'Caregiving', TRUE),
    (6, 'Companion care', 'Caregiving', TRUE),
    (7, 'Driver', 'Domestic', TRUE),
    (8, 'Gardening', 'Maintenance', TRUE),
    (9, 'Laundry', 'Domestic', TRUE),
    (10, 'Security', 'Security', TRUE),
    (11, 'Custom', 'General', TRUE)
ON CONFLICT (id) DO NOTHING;

SELECT setval('staff_services_id_seq', (SELECT MAX(id) FROM staff_services));

-- 2. Household Staff Profiles
CREATE TABLE IF NOT EXISTS household_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    service_id INT REFERENCES staff_services(id),
    name VARCHAR(100) NOT NULL,
    custom_role VARCHAR(100),
    role VARCHAR(100) NOT NULL,
    rate_type VARCHAR(20) NOT NULL DEFAULT 'MONTHLY' CHECK (rate_type IN ('MONTHLY', 'HOURLY')),
    rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (rate >= 0.00),
    currency VARCHAR(5) NOT NULL DEFAULT 'INR',
    phone VARCHAR(20),
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
    termination_date DATE,
    shift_start_time VARCHAR(10),
    shift_end_time VARCHAR(10),
    working_days_per_week INT DEFAULT 6 CHECK (working_days_per_week BETWEEN 1 AND 7),
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'TERMINATED')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_staff_family_id ON household_staff(family_id);
CREATE INDEX IF NOT EXISTS idx_staff_active ON household_staff(family_id, active) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_name_trgm ON household_staff USING gin (name gin_trgm_ops);

-- 3. Staff Attendance Records
CREATE TABLE IF NOT EXISTS staff_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES household_staff(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'PAID_LEAVE', 'UNPAID_LEAVE')),
    check_in_time VARCHAR(10),
    check_out_time VARCHAR(10),
    working_hours NUMERIC(4, 2),
    notes VARCHAR(255),
    marked_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    marked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_staff_daily_attendance UNIQUE (staff_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_staff_month ON staff_attendance(staff_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_family_date ON staff_attendance(family_id, attendance_date);

-- 4. Staff Financial Transactions & Ledger
CREATE TABLE IF NOT EXISTS staff_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES household_staff(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('ADVANCE', 'OVERTIME', 'BONUS', 'TIP', 'DEDUCTION', 'SALARY_PAYMENT')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0.00),
    currency VARCHAR(5) NOT NULL DEFAULT 'INR',
    reason VARCHAR(255) NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('UPI', 'CASH', 'BANK_TRANSFER')),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    repayment_month VARCHAR(7), -- e.g. "2026-08"
    settled_in_payroll_id UUID,
    recorded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_staff_txn_staff_id ON staff_transactions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_txn_family_id ON staff_transactions(family_id);
CREATE INDEX IF NOT EXISTS idx_staff_txn_date ON staff_transactions(staff_id, transaction_date);

-- 5. Staff Monthly Payroll Settlements
CREATE TABLE IF NOT EXISTS staff_payroll_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES household_staff(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL, -- "YYYY-MM"
    gross_amount NUMERIC(12, 2) NOT NULL,
    deductions_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_paid_amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(5) NOT NULL DEFAULT 'INR',
    payment_method VARCHAR(20) NOT NULL DEFAULT 'UPI' CHECK (payment_method IN ('UPI', 'CASH', 'BANK_TRANSFER')),
    payment_reference VARCHAR(100),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_id UUID REFERENCES staff_transactions(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'SETTLED' CHECK (status IN ('SETTLED', 'CANCELLED')),
    notes TEXT,
    settled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_staff_monthly_payroll UNIQUE (staff_id, month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_family_month ON staff_payroll_settlements(family_id, month);
CREATE INDEX IF NOT EXISTS idx_payroll_staff_month ON staff_payroll_settlements(staff_id, month);
```

---

## 8. Postman Collection Integration Blueprint

To import directly into `Saheli Backend — Auth, Profile & Family.postman_collection.json` under `Household Operations` -> `Staff & Caregiver Hub`:

```json
{
  "name": "Staff & Caregiver Hub",
  "item": [
    {
      "name": "1. Get Available Staff Services List",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/staff/services",
          "host": ["{{baseUrl}}"],
          "path": ["api", "staff", "services"]
        }
      }
    },
    {
      "name": "2. Add Caregiver / Staff Member",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"serviceId\": 7,\n  \"name\": \"Ramesh Kumar\",\n  \"customRole\": null,\n  \"rateType\": \"MONTHLY\",\n  \"rate\": 15000.00,\n  \"currency\": \"INR\",\n  \"phone\": \"9876543210\",\n  \"emergencyContactName\": \"Sunita Kumar\",\n  \"emergencyContactPhone\": \"9876543211\",\n  \"joiningDate\": \"2026-08-01\",\n  \"shiftStartTime\": \"08:00\",\n  \"shiftEndTime\": \"17:00\",\n  \"workingDaysPerWeek\": 6,\n  \"notes\": \"Family driver\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/families/{{familyId}}/staff",
          "host": ["{{baseUrl}}"],
          "path": ["api", "families", "{{familyId}}", "staff"]
        }
      }
    },
    {
      "name": "3. Get Family Staff List (Paginated)",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/families/{{familyId}}/staff?page=0&size=10&active=true",
          "host": ["{{baseUrl}}"],
          "path": ["api", "families", "{{familyId}}", "staff"],
          "query": [
            { "key": "page", "value": "0" },
            { "key": "size", "value": "10" },
            { "key": "active", "value": "true" }
          ]
        }
      }
    },
    {
      "name": "4. Get Single Staff Details",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/families/{{familyId}}/staff/{{staffId}}",
          "host": ["{{baseUrl}}"],
          "path": ["api", "families", "{{familyId}}", "staff", "{{staffId}}"]
        }
      }
    },
    {
      "name": "5. Mark Daily Attendance",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"date\": \"2026-08-31\",\n  \"status\": \"PRESENT\",\n  \"checkInTime\": \"08:00\",\n  \"checkOutTime\": \"17:00\",\n  \"workingHours\": 9.0,\n  \"notes\": \"On time\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/families/{{familyId}}/staff/{{staffId}}/attendance",
          "host": ["{{baseUrl}}"],
          "path": ["api", "families", "{{familyId}}", "staff", "{{staffId}}", "attendance"]
        }
      }
    },
    {
      "name": "6. Record Advance / Extra Payment",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"type\": \"ADVANCE\",\n  \"amount\": 2000.00,\n  \"currency\": \"INR\",\n  \"reason\": \"Medical emergency for son\",\n  \"paymentMethod\": \"CASH\",\n  \"transactionDate\": \"2026-08-15\",\n  \"repaymentMonth\": \"2026-08\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/families/{{familyId}}/staff/{{staffId}}/transactions",
          "host": ["{{baseUrl}}"],
          "path": ["api", "families", "{{familyId}}", "staff", "{{staffId}}", "transactions"]
        }
      }
    },
    {
      "name": "7. Get Monthly Payroll Summary",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/families/{{familyId}}/staff/{{staffId}}/payroll/summary?month=2026-08",
          "host": ["{{baseUrl}}"],
          "path": ["api", "families", "{{familyId}}", "staff", "{{staffId}}", "payroll", "summary"],
          "query": [
            { "key": "month", "value": "2026-08" }
          ]
        }
      }
    },
    {
      "name": "8. Settle Monthly Salary",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"month\": \"2026-08\",\n  \"finalAmount\": 13466.67,\n  \"currency\": \"INR\",\n  \"paymentMethod\": \"UPI\",\n  \"advanceDeducted\": 2000.00,\n  \"paymentReference\": \"UPI/CR/20260831123456\",\n  \"paymentDate\": \"2026-08-31\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/families/{{familyId}}/staff/{{staffId}}/payroll/settle",
          "host": ["{{baseUrl}}"],
          "path": ["api", "families", "{{familyId}}", "staff", "{{staffId}}", "payroll", "settle"]
        }
      }
    },
    {
      "name": "9. Get Caregiver Dashboard Summary",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/families/{{familyId}}/staff/dashboard-summary",
          "host": ["{{baseUrl}}"],
          "path": ["api", "families", "{{familyId}}", "staff", "dashboard-summary"]
        }
      }
    }
  ]
}
```

---

## 9. Next Steps for Backend & Frontend Teams

1. **Backend Flyway Execution:** Run `V7__caregiver_and_home_services.sql` on the PostgreSQL instance.
2. **Spring Boot Controller & Service Implementation:**
   - Package: `com.habita.staff`
   - Controllers: `StaffServiceController`, `StaffController`, `StaffAttendanceController`, `StaffTransactionController`, `StaffPayrollController`.
   - Services: `StaffService`, `AttendanceService`, `StaffTransactionService`, `PayrollCalculationService`.
3. **Frontend Integration:**
   - Create `src/features/staff/api.ts` wrapping all REST endpoints with automatic bearer auth injection and offline `AsyncStorage` cache fallback.
   - Wire `StaffScreen.tsx` to live backend endpoints whenever `familyId` is active.

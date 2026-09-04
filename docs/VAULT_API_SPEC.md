# Habita AI — Vault (Document Hub) Backend API Specification & Requirements

> **Target Audience:** Backend Developers & AI Agents building the Spring Boot / PostgreSQL backend for Habita AI.
> **Module Reference:** SRS "Encrypted Vault" module — bottom-nav tab `vault` → `DocHub` stack.
> **Frontend Consumers:**
> - `src/features/money/document_hub/screens/DocHubScreen.tsx` (list, search, category filter)
> - `src/features/money/document_hub/screens/DocDetailsScreen.tsx` (single document view, delete)
> - `src/features/money/document_hub/screens/AddDocScreen.tsx` (template picker)
> - `src/features/money/document_hub/screens/DocTemplateFormScreen.tsx` (create)
> - `src/features/money/document_hub/screens/ExpirationAlertsScreen.tsx` (expiry list, renew)
> - `src/features/money/document_hub/docStore.ts` (dual-mode store — remote-first, local fallback)
> - `src/features/money/document_hub/api.ts` (HTTP layer)
> - `src/features/money/document_hub/types.ts`
>
> **Status (2026-09-04):** Backend does not exist yet. This document is the contract the
> frontend has already been wired against (`docStore.ts` calls these endpoints whenever an
> access token is available) — until the backend is deployed, every call fails with a
> network error and the app transparently falls back to on-device storage, exactly like
> the existing Expense Groups / Medicine modules do before their backends were live. Once
> these endpoints are deployed matching this contract, the vault becomes live with **no
> frontend changes required**.

---

## 1. Executive Summary & Domain Scope

The Vault ("Document Hub") lets a household store and track important documents —
passports, visas, driving licenses, insurance policies, warranties, property papers, tax
records — with an optional scanned/photographed file attachment, and get proactively
warned before they expire.

### Core Business Capabilities

1. **Document Repository:** Create, list, update, and delete document records scoped to
   the caller's household (family), each with a category, an owner/member label, key
   dates, free-text metadata, and an optional attached file.
2. **File Attachment:** Optionally attach one scanned file (PDF, JPEG, or PNG) per
   document, stored securely and served back via a short-lived presigned URL — never a
   permanent public link.
3. **Expiry Tracking:** Every document has an `expiryDate`. The client computes
   `valid` / `expiring` (≤ 60 days out) / `expired` status **purely client-side**
   (`getDocStatus()` in `docStore.ts`) from that one field — the backend does not need to
   compute or return a status enum, just store and return an accurate `expiryDate`. This
   mirrors how the client already treats other date-derived UI state elsewhere in the app
   (e.g. Medicine's adherence banner) and keeps clock-skew/timezone edge cases in exactly
   one place.
4. **Search & Filter:** Category filter and free-text search (title / owner name /
   document number) — implemented client-side against the full list today, same as
   Expense Groups' category chips; the list endpoint should support equivalent
   server-side `category`/`search` query params so this can move server-side once the
   list grows large enough to paginate (see §4.1's note).
5. **Household-Wide Visibility:** A vault document belongs to the caller's household, not
   to one individual — any member of the family can see, add, and manage every document,
   the same trust model Expense Groups uses (§2 below), not the stricter per-profile
   isolation Medicine uses. `memberName` / `coveredMembers` are free-text labels describing
   *whose* document it is, not an access-control boundary.

---

## 2. Authentication & Authorization

- **Standard Header:** All requests require standard Bearer token authentication:
  ```http
  Authorization: Bearer <accessToken>
  ```
- **User Identity & Family Resolution:** The authenticated caller's `userId` is extracted
  from the JWT (`sub` / `userId`), then resolved server-side to that user's primary
  family (same resolution `GET /api/families/me` / `getMyPrimaryFamily()` already performs
  client-side elsewhere) — **no `familyId` is sent by the client on any Vault request**,
  exactly like `GET/POST /api/expense-groups` never takes one either. This keeps the Vault
  endpoints shaped identically to the already-familiar Expense Groups contract.
- **Membership Gate:** Every operation (list/create/read/update/delete) requires the
  caller to be an active member of their resolved family. There is no owner-only
  restriction on Vault documents — any member may add, edit, or delete any document in
  the shared vault (household trust model, §1.5).
- **No family yet:** If the caller has no family (hasn't created/joined one), return
  `404 Not Found` / `NO_FAMILY` — the client already handles this by staying in local-only
  (on-device) mode until a family exists, the same fallback it uses today before any
  backend exists at all.

---

## 3. Supported Enums & Data Types

### 3.1 Document Category

```typescript
type DocCategory =
  | 'passport'
  | 'visa'
  | 'license'
  | 'insurance'
  | 'warranty'
  | 'property'
  | 'tax';
```

Reject any other value with `400 Bad Request` / `INVALID_CATEGORY`.

### 3.2 Vault Document

```typescript
interface VaultDocument {
  id: string;
  familyId: string;              // resolved server-side, never client-supplied (§2)
  title: string;
  category: DocCategory;
  docNumber: string | null;      // passport #, policy #, license #, etc. — sensitive, see §5.2
  memberName: string;            // free-text "whose document" label, e.g. "Animesh Manna"
  issueDate: string | null;      // "YYYY-MM-DD"
  expiryDate: string;            // "YYYY-MM-DD" — required, drives all expiry UI (§1.3)
  notes: string | null;
  country: string | null;
  issuingAuthority: string | null;
  coveredMembers: string | null; // free-text, e.g. "Animesh, Priya, Rahul" (insurance policies)
  fileName: string | null;       // original filename of the attachment, if any
  fileUrl: string | null;        // presigned, short-lived (~10 min) GET URL — null if no file attached
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
}
```

### 3.3 File Constraints

- **Accepted MIME types:** `application/pdf`, `image/jpeg`, `image/png`.
- **Max file size:** 10 MB (matches the client's picker; reject larger uploads with
  `413 Payload Too Large` / `FILE_TOO_LARGE`).
- Exactly one file per document — uploading a new file on update **replaces** the
  previous one (the old object should be deleted from storage, not retained).

---

## 4. REST API Endpoint Specifications

Base Path: `/api/vault/documents`

### 4.1 `GET /api/vault/documents`

Lists every document in the caller's family vault.

- **Headers:** `Authorization: Bearer <token>`
- **Query Parameters (all optional):**
  - `category` — one of §3.1's values; omitted or `all` returns every category.
  - `search` — case-insensitive substring match against `title`, `memberName`, and
    `docNumber`. The client currently does this filtering itself against the full list
    (`DocHubScreen.tsx`'s `filteredDocs`), so honoring this param is a nice-to-have, not a
    blocker — implement it whenever server-side filtering is convenient, the client
    doesn't depend on it yet.
  - `page` / `size` — 0-indexed page number / page size. **Not yet consumed by the
    client** (it still expects a plain array, see below) — reserved for when the vault
    grows large enough to need it, following the exact pagination rollout precedent set in
    `docs/EXPENSES_API_SPEC.md` §4.1's "Contract change (2026-08-29)". Implementing
    pagination now is fine; just also return the full unpaginated array shape until the
    client is updated to consume `{content, totalElements, totalPages}` (same
    `Array.isArray(res)` graceful-degradation pattern `expenseStore.ts` already uses for
    the analogous expenses-list endpoint).
- **Response (200 OK):**
```json
[
  {
    "id": "vault_doc_a1b2c3",
    "familyId": "fam_1",
    "title": "Indian Passport (Animesh)",
    "category": "passport",
    "docNumber": "Z8942104",
    "memberName": "Animesh Manna",
    "issueDate": "2020-04-12",
    "expiryDate": "2030-04-11",
    "notes": "Primary passport, kept in desk safe",
    "country": "India",
    "issuingAuthority": "Passport Seva Kendra Kolkata",
    "coveredMembers": null,
    "fileName": "passport_scan.pdf",
    "fileUrl": "https://cdn.habita.app/vault/fam_1/vault_doc_a1b2c3.pdf?X-Amz-Expires=600&...",
    "createdAt": "2026-08-01T09:00:00Z",
    "updatedAt": "2026-08-01T09:00:00Z"
  }
]
```
- Sort order: `createdAt` descending (newest first) — matches the client's local-fallback
  ordering (`addDocument` prepends).
- An empty family vault returns `[]`, not `404`.

---

### 4.2 `POST /api/vault/documents`

Creates a new document, with an optional file attachment, in one multipart request.

- **Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`.
- **Parts:**
  - `metadata` — **required**, a JSON-typed text part (not a plain string part — same
    gotcha already documented for Medicine's `documentType` part in
    `src/features/medicine/api.ts` and `docs/DECISIONS.md` D-013–D-015: a bare string part
    arrives at Spring as `application/octet-stream` and is rejected. Send it as
    `{string: JSON.stringify(metadata), type: 'application/json'}` client-side; the
    backend should bind it as a JSON request body part, e.g.
    `@RequestPart("metadata") CreateVaultDocumentRequest metadata`).
    ```json
    {
      "title": "Indian Passport (Animesh)",
      "category": "passport",
      "docNumber": "Z8942104",
      "memberName": "Animesh Manna",
      "issueDate": "2020-04-12",
      "expiryDate": "2030-04-11",
      "notes": "Primary passport, kept in desk safe",
      "country": "India",
      "issuingAuthority": "Passport Seva Kendra Kolkata",
      "coveredMembers": null
    }
    ```
  - `file` — **optional** binary part (PDF/JPEG/PNG, ≤ 10 MB per §3.3). Omit entirely if
    the user didn't attach a file — don't send an empty part.
- **Validation Rules:**
  1. `title`: 1–150 characters, non-empty.
  2. `category`: must be one of §3.1's values.
  3. `memberName`: 1–120 characters, non-empty.
  4. `expiryDate`: required, valid `YYYY-MM-DD`.
  5. `issueDate`, if present, must be `<= expiryDate`.
  6. `file`, if present: MIME type and size per §3.3.
- **Response (201 Created):** Full `VaultDocument` object (§3.2), with `fileUrl` freshly
  presigned if a file was attached.

---

### 4.3 `GET /api/vault/documents/{documentId}`

Fetches a single document, with a freshly presigned `fileUrl`.

- **Response (200 OK):** `VaultDocument` object.
- **Response (404 Not Found):** `DOCUMENT_NOT_FOUND` — id doesn't exist or isn't in the
  caller's family.

---

### 4.4 `PUT /api/vault/documents/{documentId}`

Updates a document's metadata and/or replaces its attached file. Used for both a full
edit and the Expiration Alerts screen's quick "renew" (expiry-date-only) update — the
client always sends the complete current metadata on either action, not a partial patch,
so the backend can treat this as a full replace of every field in `metadata`.

- **Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
  (identical shape to §4.2 — `metadata` JSON part required, `file` part optional).
- **Behavior:**
  - If `file` is present, it **replaces** the existing attachment (old file deleted from
    storage).
  - If `file` is omitted, the existing attachment (if any) is left untouched — omitting
    the part is not the same as clearing the attachment (there is no "remove file without
    replacing it" flow in the current UI, so no separate clear-file signal is needed yet).
- **Validation:** Same rules as §4.2.
- **Response (200 OK):** Updated `VaultDocument` object.
- **Response (404 Not Found):** `DOCUMENT_NOT_FOUND`.

---

### 4.5 `DELETE /api/vault/documents/{documentId}`

Deletes a document and its attached file (if any) permanently — no soft-delete/undo, this
is a single-item personal-document repository, not an auditable ledger like Expenses.

- **Response (204 No Content)**
- **Response (404 Not Found):** `DOCUMENT_NOT_FOUND` — treat as success client-side (the
  client removes its local copy regardless of whether the server call succeeds, fails
  validation, or 404s — see §6's client migration note on `deleteDocument`).

---

## 5. Implementation Notes for the Backend Team

### 5.1 Expiry status is never sent or received over the wire

Don't add a `status: 'valid' | 'expiring' | 'expired'` field to `VaultDocument`. It's a
pure function of `expiryDate` and "now" (`getDocStatus()` in `docStore.ts`, 60-day
threshold), recomputed by the client on every render — sending a server-computed status
would just be a second, potentially-stale source of truth for the same fact the client
already derives correctly and cheaply.

### 5.2 `docNumber` sensitivity

The client masks `docNumber` behind a tap-to-reveal eye icon on the details screen
(`DocDetailsScreen.tsx`'s `maskedDocNumber`) — this is a client-side-only privacy
affordance (over-the-shoulder protection), **not** an indication that the field needs
extra backend encryption beyond whatever the rest of the household's personal data
already gets. Return it in full on every response; don't mask it server-side.

### 5.3 File storage

Store attachments in an object store (S3 or equivalent) under a per-family prefix (e.g.
`vault/{familyId}/{documentId}.{ext}`), never a public bucket. Every `VaultDocument`
response computes `fileUrl` at response-time as a freshly presigned GET URL (~10 minute
expiry) — same convention as Expense Groups' member `avatarUrl` (`docs/EXPENSES_API_SPEC.md`
§3.5's note) and Medicine's `documentPath` — never persist a presigned URL as a stored
column, it goes stale.

---

## 6. Error Codes & Format

Following Spring Boot global exception handler conventions (`@ControllerAdvice`), the
same shape used across the rest of the app's contracts:

| HTTP Status | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `INVALID_CATEGORY` | `category` not one of §3.1's values. |
| `400 Bad Request` | `INVALID_EXPIRY_DATE` | `expiryDate` missing, malformed, or before `issueDate`. |
| `400 Bad Request` | `MISSING_REQUIRED_FIELD` | `title` / `memberName` / `expiryDate` blank. |
| `413 Payload Too Large` | `FILE_TOO_LARGE` | Attachment exceeds 10 MB. |
| `415 Unsupported Media Type` | `UNSUPPORTED_FILE_TYPE` | Attachment isn't PDF/JPEG/PNG. |
| `403 Forbidden` | `NOT_FAMILY_MEMBER` | Caller is not a member of the family that owns this document. |
| `404 Not Found` | `NO_FAMILY` | Caller has no family yet — client falls back to local-only mode. |
| `404 Not Found` | `DOCUMENT_NOT_FOUND` | Document id doesn't exist, or belongs to a different family. |

**Standard Error Payload:**
```json
{
  "timestamp": "2026-09-04T10:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "code": "INVALID_EXPIRY_DATE",
  "message": "expiryDate must be a valid date on or after issueDate",
  "path": "/api/vault/documents"
}
```

---

## 7. PostgreSQL Database Schema (Flyway DDL)

Suggested filename: `V14__vault_documents.sql`.

```sql
CREATE TABLE vault_documents (
    id VARCHAR(64) PRIMARY KEY,
    family_id VARCHAR(64) NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (
        category IN ('passport', 'visa', 'license', 'insurance', 'warranty', 'property', 'tax')
    ),
    doc_number VARCHAR(100) NULL,
    member_name VARCHAR(120) NOT NULL,
    issue_date DATE NULL,
    expiry_date DATE NOT NULL,
    notes TEXT NULL,
    country VARCHAR(80) NULL,
    issuing_authority VARCHAR(150) NULL,
    covered_members VARCHAR(255) NULL,
    file_name VARCHAR(255) NULL,
    file_object_key TEXT NULL, -- internal storage key; fileUrl is derived from this at response-time, never stored as a URL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vault_documents_family ON vault_documents(family_id);
CREATE INDEX idx_vault_documents_expiry ON vault_documents(expiry_date);
CREATE INDEX idx_vault_documents_category ON vault_documents(category);
```

---

## 8. Client Migration Path (`docStore.ts` Integration)

`src/features/money/document_hub/docStore.ts` already calls these endpoints whenever an
access token is available (dual-mode, same pattern as `expenseStore.ts` /
`medicineStore.ts` before their backends existed) — falling back to `AsyncStorage` on any
network failure, so the vault keeps working today and starts syncing live the moment
these endpoints are deployed matching this contract, with no further frontend changes:

1. `loadDocuments(token)` → `GET /api/vault/documents`
2. `addDocument(input, token, file?)` → `POST /api/vault/documents` (multipart)
3. `updateDocument(doc, token, file?)` → `PUT /api/vault/documents/{id}` (multipart)
4. `deleteDocument(id, token)` → `DELETE /api/vault/documents/{id}`
5. `getDocById(id, token)` → `GET /api/vault/documents/{id}` (falls back to a find over
   the locally cached list on failure)

A document created while offline gets a temporary local id (`doc_local_<timestamp>`) and
is queued only in the sense that it stays in `AsyncStorage` — there is currently no
background sync/retry queue that re-attempts the create once connectivity returns (same
limitation Expense Groups and Medicine both currently have; see
`docs/BACKEND_CONTEXT.md` if a future pass adds one for all three at once).

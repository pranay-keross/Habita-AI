# Habita AI Backend — Continuation Brief

**Read this first if you are picking up Spring Boot backend work.** This repo does not contain that backend — it is the React Native client (`AI_CONTEXT.md`, `docs/ARCHITECTURE.md`). This document exists because a real Spring Boot backend already exists *somewhere else* and has been live-tested against this client (`docs/DECISIONS.md` D-012–D-018): it consolidates everything this repo has learned about that backend's actual behavior, separately from `Habita AI Software Requirements Specification.md`'s description of where it's *supposed* to end up. Read both — they disagree in places, and this file says where.

**Status:** current as of 2026-08-11. Auth (`register`/`login`/`verify-otp`/`refresh`) and Profile (`create`/`details`/`profilePhoto`/update) are confirmed **live**. Family & Managed Members (`create`/`list`/`get`/invite-and-consent/roles/managed-members/invite-history, `/api/families/**`) is a real, documented contract as of an updated Postman collection (2026-08-10) and the client is now built against all of it, including the `invites/history` endpoint added to the client 2026-08-11 (`docs/DECISIONS.md` D-023, D-024) — but unlike auth/profile, **nobody has run it against a live server yet**, so it's "contract only" until someone does. The same collection also contains early, **not-yet-usable** `medchest` scaffolding — see §2's note at the end. Everything else in §3 below is unbuilt (or at least, this repo has no evidence it's built).

---

## 1. What is confirmed live, and how we know

Everything here was proven against a running backend with real server logs (`docs/DECISIONS.md` D-013 through D-018), not inferred from the Postman collection alone — the collection (`Saheli Backend — Auth, Profile & Family.postman_collection.json`, repo root) is the source for exact shapes, but the auth flow and profile-create-with-photo path have both been round-tripped against a live server and confirmed working.

| Method | Path | Request | Response | Confirmed |
| --- | --- | --- | --- | --- |
| `POST` | `/api/auth/register` | `{phone}` | 200: `{message, devOtp}` in demo mode | Live |
| `POST` | `/api/auth/login` | `{phone}` | 200: `{message, devOtp}` in demo mode | Live |
| `POST` | `/api/auth/verify-otp` | `{phone, code}` | 200: `{accessToken, refreshToken, expiresIn, userId}` | Live |
| `POST` | `/api/auth/refresh` | `{refreshToken}` | 200: same shape as verify-otp | Live — `useAuth()` now calls this transparently on an expired access token (`docs/DECISIONS.md` D-027, 2026-08-11); a genuinely expired token, sent unrefreshed, previously got a bare `403` with no body |
| `POST` | `/api/profile/create` | multipart: `profileRequest` JSON part `{name, email, city, preferredLanguage}` + optional `profilePhoto` file part | plain text `"Profile Saved Successfully"` | Live, including the S3 photo upload |
| `GET` | `/api/profile/details` | — (Bearer token) | 200: `{phone, name, email, preferredLanguage, active, isVerified, avatarUrl, city}` | Contract only |
| `PUT` | `/api/profile/details` | `{email, preferredLanguage, city}` — **no `name` field, unlike create** | plain text `"Profile Updated Successfully"` | Live — and confirmed **broken**: 400s with an unrelated photo-update error message, see §3 item 5 |
| `PUT` | `/api/profile/profilePhoto` | multipart: `profilePhoto` file part only | plain text `"Profile Photo Updated Successfully"` | Contract only |

`/api/auth/**` is public (no Bearer token); everything under `/api/profile/**` requires one, per the collection's collection-level Bearer auth.

**Phone format — a live constraint, and it disagrees with the SRS.** The backend validates a **bare 10-digit Indian mobile number** — `register`/`login`/`verify-otp` all 400 with `"phone: must be a valid 10-digit Indian mobile number"` on anything else, confirmed both in the collection's saved examples and in live testing. `Habita AI Software Requirements Specification.md` §4 Module 1 instead specifies **"Universal phone-based authentication (E.164 standard)"** — international, not India-only. These are not the same validator. The client already has to support non-Indian country codes for the es/ar locales (`getCountryCodeForLang` in `phone.tsx` offers `+34`/`+966`), so international numbers already reach the backend and fail today. **If backend work resumes, reconciling this — moving the validator from a hardcoded Indian-mobile regex to real E.164 — is probably the single highest-value first change**, since every other module's phone-touching feature (Family invites, Caregiver contacts, Voice contact matching) inherits whatever `User.phone` accepts.

**Token TTL — also disagrees with the SRS.** A live `verify-otp` response's `expiresIn` was `3600000` (1 hour, in ms). SRS §3.1 states JWTs carry `iat`/`exp` with a **30-day TTL**. Either the deployed backend's JWT config doesn't match the SRS yet, or the SRS describes a target that hasn't been applied. Don't assume 30 days is what's actually issued — check a fresh `verify-otp` response's `expiresIn`, don't trust the spec.

**`/api/profile` isn't in the SRS's own API table.** SRS §6 lists `/api/auth, /api/managed-members` as the Auth domain's routes and has no separate profile line. The already-built backend has a distinct `/api/profile/**` group. Not a bug — just note it if you're reconciling the live backend against the SRS's API summary table, so a real difference doesn't get "fixed" into an inconsistency.

---

## 2. Family & Managed Members — contract only, not yet live-tested

Added to `Saheli Backend — Auth, Profile & Family.postman_collection.json` 2026-08-10 (renamed "Auth, Profile & Family," 700 → 3294 lines). The client is fully built against this (`src/features/family/api.ts`, `docs/DECISIONS.md` D-023, `docs/ARCHITECTURE.md` §7) — but **treat every row below as unverified against a running server**, the same caution `docs/ARCHITECTURE.md` §7 states for the client side. All require a `USER`-typed Bearer token except where noted.

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/families` | `{name}` → the caller becomes sole `OWNER` |
| `GET` | `/api/families` | Every family the caller belongs to, any role |
| `GET` | `/api/families/{id}` | 401 if caller isn't a member, 404 if it doesn't exist |
| `POST` | `/api/families/{id}/members` | `{phone, role}` — creates a `PENDING` invite for an **already-registered** user, does not attach them. `role` can't be `OWNER`. Needs `OWNER`/`ADMIN` |
| `GET` | `/api/families/invites` | Invites addressed to the caller, across every family |
| `POST` | `/api/families/invites/{id}/accept` | Creates the `FamilyMember` row, marks invite `ACCEPTED`. Capacity (max 5) re-checked here |
| `POST` | `/api/families/invites/{id}/decline` | Marks invite `DECLINED`, 204 |
| `GET` | `/api/families/{id}/invites` | Every `PENDING` invite for this family. Needs `OWNER`/`ADMIN` |
| `DELETE` | `/api/families/{id}/invites/{inviteId}` | Cancel a still-pending invite. Needs `OWNER`/`ADMIN` |
| `PATCH` | `/api/families/{id}/members/{memberId}/role` | `{role}` — `OWNER`'s own role can't be changed, and `role` can't be set to `OWNER`. Needs `OWNER`/`ADMIN` |
| `DELETE` | `/api/families/{id}/members/{memberId}` | Owner can never be removed. **Needs `OWNER`/`ADMIN` on the caller** — a plain `MEMBER` cannot remove even their own row, i.e. there is no self-service leave |
| `POST` | `/api/families/{id}/managed-members` | `{name, relationship}` (`relationship` is free text, not an enum) — attaches immediately, no consent step, since a dependent can't consent. Needs `OWNER`/`ADMIN` |
| `DELETE` | `/api/families/{id}/managed-members/{managedMemberId}` | Deletes the `FamilyMember` link **and** sets the underlying `ManagedMember.active = false` — takes `managedMemberId`, not `familyMemberId`. Needs `OWNER`/`ADMIN` |
| `GET` | `/api/families/{id}/invites/history` | Every invite ever sent for this family, any status (`PENDING`/`ACCEPTED`/`DECLINED`/`CANCELLED`) — unlike the `/invites` row above, which the backend filters to `PENDING` only. 401 "You are not a member of this family" if the caller isn't a member. Needs `OWNER`/`ADMIN`; added to the client 2026-08-11 (`docs/DECISIONS.md` D-024) |

`FamilyMemberResponse` is `{id, name, role, managed, managedMemberId}`. **It carries no `userId`** — the only response that can tell you "this row is the caller" is matching `Family.ownerUserId` against the caller's own `userId` (from `verify-otp`). For any non-owner member, there is no field to match on at all; the client works around this with a best-effort name match (`resolveMyMembership()`, `docs/ARCHITECTURE.md` §7), which is a client-side patch for a real gap in the response shape, not a preference. **If backend work resumes, adding `userId` to `FamilyMemberResponse` (or a dedicated `GET /families/{id}/me`) would remove this workaround entirely** — likely a small change with an outsized effect on client code quality.

**No self-service leave**, noted above, is the second real gap: Remove Member's admin-only guard makes sense for removing *someone else*, but it also blocks a plain `MEMBER` from removing themselves. A `DELETE /families/{id}/members/me` (or relaxing the guard to "admin, or the row being removed belongs to the caller") would close this.

**A `Medchest` folder exists in the collection but is not a usable contract yet — do not build client code against it.** Two requests, `Create profile` and `Get Profile details`, hit `{{family}}/{{familyId}}/profiles` with a JSON body `{name, category, dateOfBirth}` (`category` looks like an enum — `"CHILD"` in the request example, `"KID"` in the response example, which disagree with each other). Two things make this unsafe to integrate against as-is: the `{{family}}` collection variable is blank (unlike `{{baseUrl}}`, which resolves), so the actual base path is unknown; and a third request, `New Request`, is a completely empty placeholder. Read together, this looks like in-progress `medchest` backend scaffolding that got swept into the export rather than a finished, intentional addition — flagged here (`docs/DECISIONS.md` D-024) rather than acted on. If a future collection export has `{{family}}` populated and the `category` disagreement resolved, that's the signal this has become real — `docs/ARCHITECTURE.md` §5's `Medicine`/`IntakeLogEntry` types are the client-side reference shape to reconcile it against, per §5's suggested work order below.

---

## 3. Known backend bugs and inconsistencies (not fixable from this repo)

Found via live testing, documented here so they aren't rediscovered from scratch. None of these can be fixed from the client — they need the backend's own source.

1. **`POST /profile/create` isn't idempotent — 500s on a second call for the same user.** (`docs/DECISIONS.md` D-016) A repeat create hits `DataIntegrityViolationException` / Postgres `duplicate key value violates unique constraint "uq_user_profiles_user_id"`, because `createProfile` does a plain `INSERT` with no existence check. Should either update-if-exists or return a clean `409 Conflict`.
2. **`GET /profile/details` on a nonexistent profile returns 500, not 404.** The collection documents this as expected behavior ("500 Internal Server Error — profile not created yet"), which is itself the bug — a missing-row case should be a clean 404/empty response, not an unhandled exception surfacing as a 500.
3. **Inconsistent with #2: `PUT /profile/profilePhoto` on a nonexistent profile *does* return a clean `404 Not Found — "User profile not found"`.** So the backend already has the right pattern in one place and the wrong one in another for the same underlying condition ("this user has no profile row yet"). Fixing #2 to match #3's behavior is probably a smaller change than it looks.
4. **The multipart JSON part needs an explicit `Content-Type: application/json`, and RN's plain-string `FormData` part does not provide one.** (`docs/DECISIONS.md` D-013–D-015) This isn't a backend bug, but it's a real gotcha that will recur on every future multipart endpoint this SRS implies — pantry barcode/receipt scans, pharmacy bill OCR, wardrobe photos, document vault uploads, vehicle documents. Spring's `@RequestPart` needs the part's Content-Type set to select a message converter; a bare string part arrives from RN as `application/octet-stream` and 415s. The client-side fix (`profile.tsx`) is `form.append(name, {string: JSON.stringify(x), type: 'application/json'})`, not `form.append(name, JSON.stringify(x))`. Worth telling whoever owns each future multipart endpoint's client integration, rather than re-discovering it per module.
5. **`PUT /profile/details` 400s with an error message that talks about updating a photo, even when the request has nothing to do with a photo.** (`docs/DECISIONS.md` D-027, 2026-08-11) Confirmed live and reproducible on a real test account: `PUT /api/profile/details` with a plain `{email, preferredLanguage, city}` JSON body — no multipart, no photo field anywhere in the request — 400s with `{"message": "Oops some server error happened while updating the photo", "path": "/api/profile/details", ...}`. The message strongly suggests the two `/profile/details` and `/profile/profilePhoto` handlers share code (an exception handler, a service method) that got miswired, so a failure that's actually about `/profile/details` surfaces the neighboring endpoint's error text. Not investigated further than the request/response evidence above — that's a backend-source question. This was masked until now by a *different*, client-side gap: session tokens were never refreshed (`docs/DECISIONS.md` D-027), so this endpoint always failed earlier with an opaque `403`/empty-body before the backend ever got far enough to run into this bug.

---

## 4. Target architecture (from the SRS — not yet built beyond §1/§2)

`Habita AI Software Requirements Specification.md` (repo root) is the full spec. Summarized here only as an index — read the SRS itself for entity fields and capability detail, don't treat this table as the source of truth.

**Stack:** Java 21 LTS, Spring Boot 3.3+, PostgreSQL 16+ (`pg_trgm` for fuzzy search), Spring Data JPA/Hibernate, Flyway, MapStruct, Spring Security 6 (stateless JWT, HS256/RS256). Root package `com.habita`.

**Domain packages** (SRS §2.2) and the client milestone that will eventually consume each one — cross-reference `docs/BACKLOG.md`:

| Package | SRS module | Client milestone | Client status today |
| --- | --- | --- | --- |
| `auth` | Identity & Managed Members | onboarding | Auth/Profile real and live-confirmed (§1); Managed Members real too, but folded into the `family` package's endpoints (`/api/families/{id}/managed-members`), not a separate `/api/managed-members` the SRS's own table implies — see §2 |
| `family` | Multi-Tenant Family Sharing | closes `M8-T3`, `M2-T9` | Client fully integrated against the real contract (§2, `docs/DECISIONS.md` D-023) — but contract-only, not live-tested. **No jsonb permission matrix in the actual contract** — role-only (`OWNER`/`ADMIN`/`MEMBER`); the client's old local permission matrix was dropped, not mapped onto it |
| `medchest` | Medical Chest & Prescriptions | `M4-T1/T2/T3/T5` | Client-side CRUD + intake log + adherence built and local-only (`habita.medicines`, `habita.medicine_intake_log`) — second-closest to backend-parity-ready |
| `wellness` | Mental Health & CBT Coaching | `M4-T6/T7` | Not built client-side yet |
| `cycle` | Hormonal Health & Life-Stage | `M4-T8/T9` | Not built client-side yet |
| `dochub` | Household Document Hub | `M5-T1..T5` | Not built |
| `staff` | Caregiver & Home Services Hub | `M5-T6..T8` | Not built |
| `resources` | Resource & Utility Logistics | `M5-T9/T10` | Not built |
| `events` | Shared Family Events & Budgeting | `M5-T11` | Not built |
| `vehicles` | Property Asset Vault & Vehicle Upkeep | `M5-T12` | Not built |
| `expensegroups` | Multi-Currency Expense Groups | `M6-T1..T4` | Not built |
| `payments`, `upi` | Payment Rails & Global Subscriptions | `M6-T6` | Not built; blocked on gateway decision (`docs/BACKLOG.md` open question 3) |
| `pantry` | Smart Pantry & Allergen Radar | `M7-T1/T2` | Not built |
| `wardrobe` | Wardrobe & Weather-Adaptive Style Mirror | `M7-T3/T4` | Not built |
| `voice` | Voice Command & Orchestration | `M7-T5` | Not built |
| `dashboard` | Home Dashboard aggregation | `M7-T6` | Client dashboard is fully static/local; real aggregation needs this package |
| `ai` | LlmClientService (OpenAI + Gemini) | `M4-T7`, `M5-T5`, `M7-T4/T5`, all `M8-T4` hook-points | Not built; every client-side hook-point currently has a manual/local fallback per D-002/D-012 precedent, waiting on this |
| `admin` | Administrative Analytics & Governance | none directly — internal only | Not built |
| `common`, `config`, `security` | Cross-cutting | — | `security`'s JWT contract is what §1 above already exercises |

**Full API surface:** SRS §6's table (123 controllers across the routes above) is the target. §1's auth/profile slice is confirmed live; §2's family slice is a real, documented contract but not yet confirmed live; everything else in the table above is unbuilt as far as this repo has evidence of.

**Migration order** (SRS §5, `V1`–`V18`): auth/profile is `V1`, family is `V2` — both plausibly already applied given §1's live testing and §2's documented contract. `V3` onward (pantry through admin/trigram indexes) is presumably unapplied, but this repo has no way to confirm a Flyway migration state from the client side — check the backend's own `flyway_schema_history` table, don't assume from this doc.

---

## 5. Suggested backend work order

Not a mandate — a suggestion for keeping backend and client progress aligned, since `NEXT_STEPS.md` already has an opinion on client build order and this repo's whole documentation discipline (`docs/DECISIONS.md` D-006) exists to avoid two halves of a project silently diverging.

1. **Fix the two `/profile` bugs in §3** (items 1–2) — smallest scope, unblocks confirming the rest of the auth/profile contract live (`M2-T1`'s remaining unverified paths: `refresh`, `PUT /profile/details`, edit-mode photo update).
2. **Run Family against a live server at least once.** Everything in §2 is contract-only — the same gap auth/profile had before D-013–D-018 closed it with real server logs. Until that happens, treat every Family response shape as a documented claim, not a verified one.
3. **Decide the phone-format question in §1** before building anything else that touches `User.phone` — Family invites, Caregiver contacts, and Voice's fuzzy contact matching all inherit whatever the validator accepts, and retrofitting E.164 later means a data migration on every table with a phone column.
4. **Close Family's two contract gaps from §2** — add `userId` to `FamilyMemberResponse` (or a "my membership" endpoint), and a self-service leave path for a plain `MEMBER`. Both are small, both directly simplify already-shipped client code (`resolveMyMembership()`'s name-match fallback becomes unnecessary; the client-side "only `ADMIN` can leave" restriction becomes just "any member can leave").
5. **`medchest`** — client-side CRUD/schedule/stock/intake-log/adherence already exist and are well-understood (`docs/ARCHITECTURE.md` §5's data models), so the backend schema has a working reference implementation to match rather than a blank page. Now the natural next domain to integrate, the way `family` just was.
6. Everything else — follow whichever client module `NEXT_STEPS.md` picks next, so a client module doesn't finish only to sit blocked on `M8-T1` (`docs/BACKLOG.md`) waiting for its backend counterpart.

---

## 6. What this document does not own

- **Full endpoint/entity/capability detail** — `Habita AI Software Requirements Specification.md`. This doc summarizes, never restates in full; if the two disagree on a *fact* rather than a *confirmed-vs-target* distinction, the SRS wins for target architecture and §1/§2 above win for what's actually built.
- **Exact confirmed request/response bodies** — `Saheli Backend — Auth, Profile & Family.postman_collection.json` (repo root). This doc points at it, doesn't duplicate its saved examples.
- **Why each client-side decision was made the way it was** (the multipart Content-Type saga, the phone-format bug, the duplicate-profile 500, the Family permission-matrix drop) — `docs/DECISIONS.md` D-012 through D-018 and D-023, narrated in full with the evidence trail.
- **How the client currently consumes this contract** — `docs/ARCHITECTURE.md` §6 (auth/profile), §7 (family).
- **The client-side task that depends on backend progress** — `docs/BACKLOG.md` M8, specifically `M8-T1` ("gain access to a reachable Habita AI backend instance and its full API contract") and `M8-T3` (family sharing, now client-done but backend-unverified).

---

## How to keep this file honest

Same rule as every other doc in this repo (`docs/DECISIONS.md` D-006): don't mark something here as confirmed unless it was actually observed — a server log, a real response body, a passing live request. If backend work resumes and more of §4's table moves from "not built" to real, update this file's status column and add a `docs/DECISIONS.md` entry the same way D-013–D-018 documented the auth/profile work, rather than letting this file silently go stale the way the pre-D-006 docs did. The same applies in reverse: if Family (§2) gets run against a live server, move it into a "confirmed live" table the way §1 already is, don't just leave it captioned "contract only" once that stops being true.

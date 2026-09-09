# Habita AI — Wardrobe & Weather-Adaptive Style Mirror Backend API Specification & Requirements

> **Target Audience:** Backend Developers & AI Agents building the Spring Boot / PostgreSQL backend for Habita AI.
> **Module Reference:** SRS Module Group 4, §15 "Wardrobe & Weather-Adaptive Style Mirror" & API Ecosystem Summary (`/api/style`). Backend package name: `wardrobe` (`docs/BACKEND_CONTEXT.md`).
> **Frontend Consumers:**
> - `src/features/style_pantry/screens/WardrobeDashboardScreen.tsx`
> - `src/features/style_pantry/screens/StyleMirrorScreen.tsx`
> - `src/features/style_pantry/screens/OutfitDetailsScreen.tsx`
> - `src/features/style_pantry/screens/AddEditClothingScreen.tsx`
> - `src/features/style_pantry/screens/ClothingDetailsScreen.tsx`
> - `src/features/style_pantry/screens/StyleLogScreen.tsx`
> - `src/features/style_pantry/api.ts`
> - `src/features/style_pantry/stylePantryStore.ts`
> - `src/features/style_pantry/types.ts`
> - `src/features/style_pantry/moods.ts`

---

## 1. Executive Summary & Domain Scope

The Wardrobe module gives each user a private digital closet with photo storage and an
AI "Style Mirror" that recommends a full outfit for an upcoming occasion, factoring in
today's weather and what's actually in the user's closet.

### Core Business Capabilities:
1. **Digital Closet:** CRUD for wardrobe items (tops, bottoms, shoes, jackets,
   accessories) with an optional photo, brand, season, material, and free-form style
   tags (`office`, `formal`, `party`, `casual`, `workout`, `meeting`, ...).
2. **Wear Tracking:** Recording that a set of items was worn on a given date, bumping
   each item's `wearCount` and `lastWornDate` — surfaced in the UI as "worn N times" /
   "last worn on ...".
3. **Weather Context:** Today's weather, resolved server-side from the caller's saved
   profile `city` — the client never sends geolocation for this module.
4. **Occasions:** A lightweight, wardrobe-owned "upcoming occasion" entity (title, date,
   time, type, optional location) the user creates to drive outfit context. This is
   **not** integrated with any external/shared calendar system — no such module exists
   elsewhere in Habita AI today, so Wardrobe owns this data outright.
5. **AI Outfit Recommendation:** Given an occasion, the server picks a coherent outfit
   (top + bottom + shoes, plus a jacket/accessory when relevant) from the caller's
   closet, scored against the occasion type and today's weather. The contract is stable
   whether this is implemented as a rule-based matcher today or backed by
   `LlmClientService` later (`docs/BACKLOG.md` M8-T4) — the response shape does not
   change either way.
6. **Saved Outfits:** Bookmarking a generated recommendation for later reference.
7. **Mood-Aware Recommendations:** An optional `mood` the caller sends alongside an
   occasion — a second, independent axis from the occasion's own `eventType` (e.g. a
   "confident" office look vs. a "relaxed" office look) — that nudges which items the
   matcher prefers within the same occasion/weather constraints. Never required; omitting
   it recommends exactly as before.
8. **Style Log (Wear History):** A per-outfit record of what was actually worn and when —
   distinct from each item's own `wearCount`/`lastWornDate` — so the client can show a
   browsable history (aCloset-style "what did I actually wear") instead of only
   aggregate per-item counters.

### Explicit scope decision — no family/group sharing
Unlike Expenses or DocHub, a closet is inherently personal. Every row in this module
(items, occasions, saved outfits) is scoped **only** to the owning `user_id` extracted
from the JWT — there is no group/family membership model here, and no endpoint accepts
or returns another user's wardrobe data.

---

## 2. Authentication & Authorization

- **Standard Header:** All requests require standard Bearer token authentication:
  ```http
  Authorization: Bearer <accessToken>
  ```
- **User Identity:** The authenticated caller's `userId` is extracted from the JWT
  claims (`sub` / `userId`) — never accepted as a request parameter.
- **Ownership Gate:** Every read/write on an item, occasion, or saved outfit must verify
  the row's `user_id` matches the caller's `userId`; a mismatch (or missing row) returns
  `404 Not Found` (not `403`), so a caller can't distinguish "not yours" from "doesn't
  exist" for another user's private closet data.

---

## 3. Supported Enums & Data Types

### 3.1 Clothing Category
```typescript
type ClothingCategory = 'tops' | 'bottoms' | 'shoes' | 'jackets' | 'accessories';
```

### 3.2 Clothing Season
```typescript
type ClothingSeason = 'summer' | 'winter' | 'monsoon' | 'spring' | 'all-year';
```

### 3.3 Occasion / Event Type
```typescript
type EventType = 'office' | 'party' | 'meeting' | 'casual' | 'formal' | 'workout';
```

### 3.4 Weather Condition
```typescript
type WeatherCondition = 'sunny' | 'rainy' | 'cloudy' | 'cold' | 'hot';
```

### 3.5 Clothing Icon Key
```typescript
type ClothingIconKey = 'shirt' | 'pants' | 'shoes' | 'jacket' | 'watch';
```
The `emoji` field on `WardrobeItem` holds one of these keys (never an actual emoji
character — matches the project-wide emoji removal, `docs/DECISIONS.md` D-054). The
client resolves each key directly to a `lucide-react-native` icon; an unrecognized value
should be rejected with `400 Bad Request` / `INVALID_ICON_KEY`.

### 3.6 Mood
```typescript
type Mood = 'confident' | 'relaxed' | 'bold' | 'cozy' | 'playful';
```
Optional, independent of `EventType` — the wearer's own axis ("how do I want to feel")
layered on top of the occasion's axis ("what is this for"). The reference matcher
(§4.4) treats each mood as a secondary preference over a small set of `WardrobeItem.tags`
values, never a hard filter:

| Mood | Preferred tags |
|---|---|
| `confident` | `formal`, `office` |
| `relaxed` | `casual` |
| `bold` | `party` |
| `cozy` | `casual`, `workout` |
| `playful` | `party`, `casual` |

An item never needs a mood-specific tag of its own — this is a second pass over the same
free-form `tags` array every item already has. An unrecognized value should be rejected
with `400 Bad Request` / `INVALID_MOOD`.

### 3.7 Core Shapes
```typescript
interface WardrobeItem {
  id: string;
  name: string;
  category: ClothingCategory;
  color: string;
  brand?: string;
  season: ClothingSeason;
  material?: string;
  tags: string[];              // e.g. ['office', 'formal', 'meeting']
  imageUri?: string;           // presigned CDN URL once a photo is uploaded
  emoji: string;                // ClothingIconKey
  wearCount: number;
  lastWornDate?: string;        // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
}

interface CalendarEvent {           // a Wardrobe "occasion"
  id: string;
  title: string;
  date: string;                 // YYYY-MM-DD
  time: string;                 // free-form display string, e.g. "7:00 PM"
  eventType: EventType;
  location?: string;
}

interface WeatherContext {
  temperature: number;          // Celsius
  condition: WeatherCondition;
  description: string;          // e.g. "28°C · Sunny & Pleasant"
  icon: string;
  city?: string;                 // resolved city, echoed back for display
}

interface OutfitRecommendation {
  id: string;
  title: string;
  occasion: string;              // EventType, upper-cased for display
  eventTitle: string;
  weatherSuitability: string;    // human-readable score, e.g. "100% Breathable for Hot Weather (28°C)"
  occasionSuitability: string;   // human-readable score, e.g. "98% Professional & Meeting Compliant"
  items: WardrobeItem[];
  stylistNote: string;
  mood?: Mood;                   // echoes back whatever mood (if any) the request sent
  isSaved?: boolean;
}

interface WornOutfitEntry {           // one Style Log row — "what did I actually wear"
  id: string;
  date: string;                  // YYYY-MM-DD
  outfitTitle: string;
  occasion: string;
  eventTitle: string;
  itemIds: string[];             // references WardrobeItem.id
  mood?: Mood;
}
```

---

## 4. REST API Endpoint Specifications

Base Path: `/api/style`

### 4.1 Wardrobe Items API

#### `GET /api/style/items`
Lists every wardrobe item owned by the caller, most recently created first.

- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** `WardrobeItem[]`

---

#### `POST /api/style/items`
Creates a wardrobe item, optionally attaching a photo. **Multipart request** — mirrors
the `document_hub`/`vault` upload convention already used elsewhere in this backend.

- **Content-Type:** `multipart/form-data`
- **Parts:**
  - `metadata` (`application/json`):
    ```json
    {
      "name": "Oxford Cotton Shirt",
      "category": "tops",
      "color": "White",
      "brand": "Brooks Brothers",
      "season": "all-year",
      "material": "100% Premium Cotton",
      "tags": ["office", "formal", "meeting"],
      "emoji": "shirt"
    }
    ```
  - `file` (optional) — the photo, any of `image/jpeg`, `image/png`, `image/webp`.
- **Response (201 Created):** `WardrobeItem` — `wearCount: 0`, `lastWornDate: null`,
  `imageUri` populated with the resolved CDN URL when a `file` part was sent.
- **Validation:** `category`/`season`/`emoji` must be in their respective enums (reject
  with `400 Bad Request` / `INVALID_CATEGORY`, `INVALID_SEASON`, `INVALID_ICON_KEY`);
  `name` required, max 120 chars.

---

#### `PUT /api/style/items/{itemId}`
Updates an item's metadata, optionally replacing its photo. Same multipart shape as
create. Omitting the `file` part leaves the existing photo untouched — it does **not**
clear `imageUri`.

- **Response (200 OK):** Updated `WardrobeItem`.
- **Response (404 Not Found):** `ITEM_NOT_FOUND` — no such item, or it isn't the
  caller's.

---

#### `DELETE /api/style/items/{itemId}`
Deletes a wardrobe item (hard delete — closet items don't need the audit-trail
soft-delete pattern Expenses uses, since there's no shared balance history depending on
them).

- **Response (204 No Content)**

---

#### `POST /api/style/items/wear`
Bulk-records that a set of items was worn on a given date — the "Wear Today" action from
`OutfitDetailsScreen`.

- **Request Body:**
```json
{
  "itemIds": ["item_1", "item_2", "item_3"],
  "wornDate": "2026-09-07"
}
```
- **Behavior:** For each `itemId` owned by the caller, increment `wearCount` by 1 and
  set `lastWornDate = wornDate`. Silently skip any id that doesn't belong to the caller
  (don't fail the whole batch for one bad id).
- **Response (204 No Content)**

---

### 4.2 Weather API

#### `GET /api/style/weather`
Returns today's weather, resolved **server-side** from the caller's saved profile
`city` (the same `city` field captured at onboarding and sent to `POST /profile/create`
— see `src/app/onboarding/profile.tsx`). The client never sends coordinates or a city
override for this endpoint.

- **Response (200 OK):**
```json
{
  "temperature": 28,
  "condition": "sunny",
  "description": "28°C · Sunny & Pleasant",
  "icon": "sun",
  "city": "Mumbai"
}
```
- **No saved city:** Fall back to a configured default city (e.g. `WARDROBE_DEFAULT_CITY`
  application property, suggested default `"Mumbai"`) rather than erroring — `city` in
  the response should still reflect whichever city was actually used, so the UI's
  "Weather in {{city}}" label stays accurate. Never return `400`/`404` for a missing
  profile city.
- **Provider:** Any standard weather API (OpenWeatherMap, WeatherAPI, etc.) works behind
  this endpoint — cache the result per city for a short TTL (5–15 min) to avoid
  rate-limiting the upstream provider on every screen open.

---

### 4.3 Occasions API

#### `GET /api/style/occasions`
Lists the caller's upcoming occasions, most recently created first.

- **Response (200 OK):** `CalendarEvent[]`

---

#### `POST /api/style/occasions`
Creates a new occasion.

- **Request Body:**
```json
{
  "title": "Client Dinner",
  "date": "2026-09-07",
  "time": "7:00 PM",
  "eventType": "formal",
  "location": "Rooftop Lounge"
}
```
- **Response (201 Created):** `CalendarEvent`
- **Validation:** `title` and `time` required; `eventType` must be a valid `EventType`
  (`400 Bad Request` / `INVALID_EVENT_TYPE` otherwise); `date` must be a valid
  `YYYY-MM-DD` (`400 Bad Request` / `INVALID_DATE`).

---

#### `DELETE /api/style/occasions/{occasionId}`
Deletes an occasion.

- **Response (204 No Content)**
- **Response (404 Not Found):** `OCCASION_NOT_FOUND`

> Editing an existing occasion (`PUT`) is intentionally out of scope for v1 — the client
> only creates, lists, and deletes occasions today. Add `PUT
> /api/style/occasions/{occasionId}` as a fast-follow if an edit UI is added later; keep
> the same request shape as create.

---

### 4.4 Outfit Recommendation API

#### `POST /api/style/recommendations/generate`
Generates an outfit recommendation for the given occasion. The server resolves the
caller's current wardrobe and today's weather itself — the client sends the `occasionId`
and, optionally, a `mood` (§3.6).

- **Request Body:**
```json
{ "occasionId": "evt_1", "mood": "confident" }
```
`mood` is optional — omit it (or send `null`) for a mood-agnostic recommendation,
identical to the pre-mood behavior.
- **Response (200 OK):** `OutfitRecommendation` (see §3.7), with `mood` echoed back
  exactly as sent (absent if the request didn't send one). `id` should be freshly
  generated per call (calling this endpoint twice for the same occasion is expected to
  return different candidate outfits, mirroring "Generate Another Outfit" in the UI).
- **Response (404 Not Found):** `OCCASION_NOT_FOUND` if `occasionId` doesn't belong to
  the caller.
- **Response (400 Bad Request):** `INVALID_MOOD` if `mood` is present but not one of the
  §3.6 values.
- **Response (422 Unprocessable Entity):** `INSUFFICIENT_WARDROBE` if the caller has too
  few items to assemble a coherent outfit (fewer than one top, one bottom, and one pair
  of shoes) — the client falls back to its own local rule-based matcher on any failure
  here, so this is safe to return rather than forcing a degraded recommendation.
- **Implementation note (M8-T4):** Ship this first as a rule-based matcher — pick items
  whose `tags` include the occasion's `eventType`, preferring (not requiring) one whose
  `tags` also include one of `mood`'s preferred tags (§3.6 table) when `mood` was sent;
  prefer a jacket when `temperature < 22°C` or `eventType == 'office'`, and derive
  `weatherSuitability`/`occasionSuitability` as descriptive strings the same way the
  client's local `generateAIOutfit()` (`src/features/style_pantry/stylePantryStore.ts`)
  already does.
  When `LlmClientService` is wired up (M8-T4), swap the implementation behind this same
  endpoint/response contract — no frontend change required either way.

---

### 4.5 Saved Outfits API

#### `GET /api/style/outfits/saved`
Lists the caller's saved (bookmarked) outfits, most recently saved first.

- **Response (200 OK):** `OutfitRecommendation[]` (`isSaved: true` on every element)

---

#### `POST /api/style/outfits/saved`
Saves (bookmarks) an outfit recommendation. Idempotent on `id` — saving an already-saved
outfit id just returns the existing row rather than duplicating it.

- **Request Body:** an `OutfitRecommendation` object (as returned by
  `POST /api/style/recommendations/generate`).
- **Response (201 Created):** the saved `OutfitRecommendation`, `isSaved: true`.

---

#### `DELETE /api/style/outfits/saved/{outfitId}`
Removes a saved outfit.

- **Response (204 No Content)**

---

### 4.6 Style History API

A `WornOutfitEntry` (§3.7) row records that a *specific outfit* was worn on a given
date — title, occasion, mood, and the item ids involved. This is deliberately separate
from `POST /api/style/items/wear` (§4.1), which only bumps each item's own
`wearCount`/`lastWornDate`: the client calls **both** endpoints from the same "Wear
Today" action (`OutfitDetailsScreen`), so implement them independently rather than
inferring one from the other.

#### `GET /api/style/history`
Lists the caller's style log, most recently worn first. Powers the Style Log screen
(`StyleLogScreen.tsx`) — an aCloset-style "what did I actually wear" view.

- **Response (200 OK):** `WornOutfitEntry[]`

---

#### `POST /api/style/history`
Records a style-log entry for an outfit just worn.

- **Request Body:** a `WornOutfitEntry` object without `id` (server assigns it):
```json
{
  "date": "2026-09-08",
  "outfitTitle": "Navy Blue Oxford Shirt + Charcoal Black Tailored Slim Trousers",
  "occasion": "OFFICE",
  "eventTitle": "Office Strategy Meeting",
  "itemIds": ["item_1", "item_2", "item_3"],
  "mood": "confident"
}
```
- **Response (201 Created):** the created `WornOutfitEntry`, with `id` populated.
- **Validation:** `date` must be a valid `YYYY-MM-DD` (`400 Bad Request` / `INVALID_DATE`);
  `mood`, if present, must be a valid `Mood` (`400 Bad Request` / `INVALID_MOOD`); any
  `itemIds` not owned by the caller are silently dropped from the stored entry rather
  than failing the whole request (same tolerance as §4.1's bulk wear endpoint).

---

## 5. PostgreSQL Database Schema (Flyway DDL)

Filename: `V4__wardrobe_style.sql` (double-underscore Flyway convention — matches the
existing `V11__multi_currency_expenses.sql` naming, correcting the SRS document's
single-underscore `V4_wardrobe_style.sql`).

```sql
-- 1. WARDROBE ITEMS TABLE
CREATE TABLE wardrobe_items (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    name VARCHAR(120) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('tops', 'bottoms', 'shoes', 'jackets', 'accessories')),
    color VARCHAR(60) NOT NULL,
    brand VARCHAR(80) NULL,
    season VARCHAR(20) NOT NULL DEFAULT 'all-year' CHECK (season IN ('summer', 'winter', 'monsoon', 'spring', 'all-year')),
    material VARCHAR(120) NULL,
    tags JSONB NOT NULL DEFAULT '[]', -- e.g. ["office", "formal", "meeting"]
    image_url TEXT NULL,              -- resolved CDN URL, private bucket + presigned at read time
    emoji VARCHAR(16) NOT NULL DEFAULT 'shirt', -- ClothingIconKey, see §3.5
    wear_count INTEGER NOT NULL DEFAULT 0,
    last_worn_date DATE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wardrobe_items_user ON wardrobe_items(user_id);
CREATE INDEX idx_wardrobe_items_category ON wardrobe_items(user_id, category);

-- 2. WARDROBE OCCASIONS TABLE
CREATE TABLE wardrobe_occasions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(150) NOT NULL,
    occasion_date DATE NOT NULL DEFAULT CURRENT_DATE,
    occasion_time VARCHAR(20) NOT NULL, -- free-form display string, e.g. "7:00 PM"
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('office', 'party', 'meeting', 'casual', 'formal', 'workout')),
    location VARCHAR(150) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wardrobe_occasions_user ON wardrobe_occasions(user_id, occasion_date);

-- 3. SAVED OUTFITS TABLE
CREATE TABLE wardrobe_saved_outfits (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    title VARCHAR(150) NOT NULL,
    occasion VARCHAR(30) NOT NULL,
    event_title VARCHAR(150) NOT NULL,
    weather_suitability VARCHAR(150) NOT NULL,
    occasion_suitability VARCHAR(150) NOT NULL,
    item_ids JSONB NOT NULL, -- ["item_1", "item_2", "item_3"] — references wardrobe_items.id, not a join table (mirrors group_expenses.shares JSONB precedent)
    stylist_note TEXT NOT NULL,
    mood VARCHAR(20) NULL CHECK (mood IS NULL OR mood IN ('confident', 'relaxed', 'bold', 'cozy', 'playful')),
    saved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wardrobe_saved_outfits_user ON wardrobe_saved_outfits(user_id);

-- 4. STYLE HISTORY TABLE — one row per "Wear Today" tap (§4.6), distinct from each
-- wardrobe_items row's own wear_count/last_worn_date above.
CREATE TABLE wardrobe_style_history (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    worn_date DATE NOT NULL,
    outfit_title VARCHAR(150) NOT NULL,
    occasion VARCHAR(30) NOT NULL,
    event_title VARCHAR(150) NOT NULL,
    item_ids JSONB NOT NULL, -- references wardrobe_items.id, not a join table (same precedent as wardrobe_saved_outfits.item_ids)
    mood VARCHAR(20) NULL CHECK (mood IS NULL OR mood IN ('confident', 'relaxed', 'bold', 'cozy', 'playful')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wardrobe_style_history_user ON wardrobe_style_history(user_id, worn_date DESC);
```

---

## 6. Error Codes & Format

Following Spring Boot global exception handler conventions (`@ControllerAdvice`):

| HTTP Status | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `INVALID_CATEGORY` | `category` not in the supported enum. |
| `400 Bad Request` | `INVALID_SEASON` | `season` not in the supported enum. |
| `400 Bad Request` | `INVALID_ICON_KEY` | `emoji` not a recognized icon key. |
| `400 Bad Request` | `INVALID_EVENT_TYPE` | `eventType` not in the supported enum. |
| `400 Bad Request` | `INVALID_DATE` | `date`/`wornDate` not a valid `YYYY-MM-DD` string. |
| `400 Bad Request` | `INVALID_MOOD` | `mood` present but not one of the §3.6 values. |
| `404 Not Found` | `ITEM_NOT_FOUND` | Wardrobe item doesn't exist, or isn't owned by the caller. |
| `404 Not Found` | `OCCASION_NOT_FOUND` | Occasion doesn't exist, or isn't owned by the caller. |
| `404 Not Found` | `OUTFIT_NOT_FOUND` | Saved outfit doesn't exist, or isn't owned by the caller. |
| `422 Unprocessable Entity` | `INSUFFICIENT_WARDROBE` | Not enough items in the closet to generate a recommendation (see §4.4). |

**Standard Error Payload:**
```json
{
  "timestamp": "2026-09-07T10:00:00Z",
  "status": 404,
  "error": "Not Found",
  "code": "ITEM_NOT_FOUND",
  "message": "No wardrobe item found with this id",
  "path": "/api/style/items/item_9"
}
```

---

## 7. Client Migration Path (`stylePantryStore.ts` Integration)

The frontend is already wired for this contract (online-first with an AsyncStorage/
local-rule-based fallback whenever a call fails or no token is available — same rollout
shape Expenses/Vault used):

1. `loadClothingItems(token)` → `GET /api/style/items`
2. `addClothingItem(input, photo, token)` / `updateClothingItem(item, photo, token)` →
   `POST` / `PUT /api/style/items/{itemId}` (multipart)
3. `deleteClothingItem(id, token)` → `DELETE /api/style/items/{itemId}`
4. `recordWearOutfit(itemIds, token)` → `POST /api/style/items/wear`
5. `loadWeather(token)` → `GET /api/style/weather`
6. `loadOccasions(token)` / `createOccasionEntry(data, token)` →
   `GET` / `POST /api/style/occasions`
7. `generateOutfitRecommendation(weather, event, items, token, mood?)` →
   `POST /api/style/recommendations/generate` (`mood` optional; falls back to the local
   `generateAIOutfit()` rule-based matcher on any failure — kept permanently as the
   manual/local fallback per `docs/BACKLOG.md` M8-T4, not a temporary shim to delete
   once the backend ships)
8. `loadSavedOutfits(token)` / `saveOutfit(outfit, token)` →
   `GET` / `POST /api/style/outfits/saved`
9. `loadStyleHistory(token)` / `logStyleHistoryEntry(outfit, token)` →
   `GET` / `POST /api/style/history` (§4.6) — called alongside `recordWearOutfit`, not
   instead of it, from `OutfitDetailsScreen`'s "Wear Today" action.

No further frontend changes are required once this backend is deployed matching the
contract above.

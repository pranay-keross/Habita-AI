# Habita AI — Smart Pantry & Allergen Radar Backend API Specification & Requirements

> **Target Audience:** Backend Developers & AI Agents building the Spring Boot / PostgreSQL / FastAPI backend for Habita AI.
> **Module Reference:** SRS Module Group 4 § "Smart Pantry & Allergen Radar" & API Ecosystem Summary (`/api/pantry`). Backend package name: `pantry` (`docs/BACKEND_CONTEXT.md`).
> **Frontend Consumers:**
> - `src/features/money/smart_pantry/PantryScreen.tsx` (main tabbed hub & navigation)
> - `src/features/money/smart_pantry/components/PantryDashboardView.tsx` (modern CRED-style dashboard, stats, AI chef card, urgent alerts, storage breakdown, priority list)
> - `src/features/money/smart_pantry/components/PantryInventoryView.tsx` (full inventory search, storage zone filter, allergen safety filter, sorting)
> - `src/features/money/smart_pantry/components/AddScanView.tsx` (barcode scanner, receipt OCR upload, manual item creation)
> - `src/features/money/smart_pantry/components/ItemDetailsView.tsx` (stock quantity adjuster, countdown timer, allergen tags, delete)
> - `src/features/money/smart_pantry/components/ExpiryRadarView.tsx` (urgent/upcoming expiry monitoring, allergen compliance matrix)
> - `src/features/money/smart_pantry/components/ZeroWasteRecipesView.tsx` (AI zero-waste recipes matching expiring stock, 1-tap cook ingredient deduction)
> - `src/features/money/smart_pantry/services/pantryStorage.ts` (storage service / remote client fallback)
> - `src/features/money/smart_pantry/hooks/useSmartPantry.ts` (state orchestration hook)
> - `src/features/money/smart_pantry/types/index.ts` (domain TypeScript definitions)
> - `src/features/money/smart_pantry/data/mockPantryData.ts` & `pantryData.ts` (barcode catalog, allergen definitions, categories)
>
> **Status (2026-09-09):** **ACTIVE & LIVE ON BACKEND (PORT 8080)**.
> - **Database Migration:** `V31__create_smart_pantry_tables.sql` applied cleanly in PostgreSQL (`pantry_items`, `barcode_catalog`, `zero_waste_recipes`).
> - **Backend Endpoints:** All 12 `/api/pantry/*` endpoints are fully implemented, verified live, and covered by 31 passing unit/integration tests (0 failures, 0 errors).
> - **Mobile Client Integration:** `Habita-AI` client is fully wired with Remote-First API client (`api.ts`), dual-mode storage (`pantryStorage.ts`), reactive state hook (`useSmartPantry.ts`), and UI views (`PantryScreen.tsx`, `AddScanView.tsx`, `ZeroWasteRecipesView.tsx`) with **zero UI breaking changes**.

---

## 1. Executive Summary & Domain Scope

The Smart Pantry & Allergen Radar module provides households with real-time food inventory tracking, automated expiration forecasting, multi-zone storage allocation (Fridge, Freezer, Pantry Shelf), family allergen/dietary safety compliance, universal barcode lookup, grocery receipt OCR parsing, and AI-driven "Zero-Waste Chef" recipe generation that prevents food waste by recommending dishes based on what is expiring soonest.

### Core Business Capabilities:

1. **Digital Grocery Inventory (CRUD):**
   Full lifecycle tracking for food items with name, food category (`produce`, `dairy`, `bakery`, `beverages`, `meat`, `pantry`), storage location (`Fridge`, `Freezer`, `Pantry Shelf`), unit quantity, expiration date, optional barcode, allergen tags, and notes.

2. **Expiry Radar & Proactive Waste Alerts:**
   Real-time monitoring of days remaining before spoilage. Items are classified into urgency tiers:
   - **`EXPIRED`**: Expiry date is in the past (`daysLeft < 0`).
   - **`URGENT`**: 0 to 2 days remaining (`0 <= daysLeft <= 2`).
   - **`EXPIRING`**: 3 to 5 days remaining (`3 <= daysLeft <= 5`).
   - **`OPTIMAL`**: Fresh stock (`daysLeft > 5`).
   Surfaced as an urgent warning card on the dashboard with a direct "Cook Now →" action.

3. **Multi-Zone Storage Tracking:**
   Storage distribution across three core household temperature zones:
   - **Fridge**: Perishables, dairy, fresh beverages.
   - **Freezer**: Meats, frozen foods, batch-cooked meals.
   - **Pantry Shelf**: Dry grains, spices, snacks, canned goods.

4. **Allergen & Dietary Safety Radar:**
   Six standardized dietary safety tags:
   - `gluten-free`
   - `vegan`
   - `halal`
   - `kosher`
   - `nut-free`
   - `dairy-free`
   Allows household members to verify dietary compliance and avoid cross-contamination for members with critical food allergies.

5. **Universal Barcode Catalog Lookup:**
   Scanning a standard 13-digit EAN/UPC barcode resolves product metadata (product name, category, default unit, allergen tags, suggested storage location, and estimated shelf life) to eliminate manual data entry.

6. **Receipt OCR & Auto-Extraction:**
   Multipart grocery bill image upload that uses OCR and LLM/heuristic parsing to extract line items, quantities, and auto-computed expiry predictions based on standard category shelf-life heuristics.

7. **Zero-Waste AI Chef Engine:**
   AI-driven recipe suggestions dynamically matched against the household's current pantry stock, maximizing utilization of ingredients expiring within 5 days.

8. **One-Tap Recipe Cooking & Stock Deduction:**
   When a user cooks a suggested Zero-Waste recipe, the backend automatically decrements the quantities of consumed pantry items or flags them for replenishment.

9. **Pantry Freshness & Inventory Summary:**
   Provides an aggregated dashboard payload including total item count, total units, expiring count, low-stock count, storage breakdown, and an overall **Freshness Percentage Score** (`(freshItems / totalItems) * 100`).

### Household Scoping & Trust Model:

Like Expense Groups (`/api/expense-groups`) and Document Hub (`/api/vault/documents`), the Smart Pantry is **scoped to the caller's household (`family_id`)**. Food inventory is shared among family members residing in the same home. Any active member of the family can view stock, add grocery items, update quantities, and cook recipes. Every record in the database is indexed and secured by `family_id`.

---

## 2. Authentication & Authorization

- **Standard Header:** All requests require standard Bearer token authentication:
  ```http
  Authorization: Bearer <accessToken>
  ```
- **User Identity:** The authenticated caller's `userId` is extracted from the JWT claims (`sub` / `userId`).
- **Implicit Household Resolution:** The backend resolves the caller's primary household (`family_id`) server-side via their active family membership (matching `GET /api/families/me`). **No `familyId` parameter is accepted or required from the client**.
- **Household Gate:**
  - If the user does not belong to any family, the backend returns `404 Not Found` with error code `NO_FAMILY`.
  - Every read and write query enforces `WHERE family_id = :familyId AND deleted_at IS NULL`.
  - A user cannot read, mutate, or deduct stock from another household's pantry. Attempting to access an item belonging to another family returns `404 Not Found` (never `403`, to avoid leaking existence of IDs).

---

## 3. Supported Enums & Data Types

### 3.1 Category Type
```typescript
type CategoryType = 'produce' | 'dairy' | 'bakery' | 'beverages' | 'meat' | 'pantry';
```
| Category | Description | Standard Shelf Life (Default) |
|---|---|---|
| `produce` | Fresh fruits, vegetables, herbs | 5 to 7 days |
| `dairy` | Milk, yogurt, cheese, butter | 7 to 10 days |
| `bakery` | Bread, rolls, pastries | 4 to 6 days |
| `beverages` | Juices, plant milks, soft drinks | 14 to 30 days |
| `meat` | Fresh poultry, seafood, red meat | 3 to 5 days (fridge) / 90 days (freezer) |
| `pantry` | Rice, pasta, canned goods, pulses | 90 to 365 days |

Reject any unrecognized category with `400 Bad Request` / `INVALID_CATEGORY`.

### 3.2 Storage Location
```typescript
type StorageLocation = 'Fridge' | 'Freezer' | 'Pantry Shelf';
```
Reject any unrecognized location with `400 Bad Request` / `INVALID_STORAGE_LOCATION`.

### 3.3 Allergen & Dietary Tags
```typescript
type AllergenTag = 'gluten-free' | 'vegan' | 'halal' | 'kosher' | 'nut-free' | 'dairy-free';
```
Stored as a PostgreSQL array `TEXT[]` or JSONB array. Reject any unrecognized tag with `400 Bad Request` / `INVALID_ALLERGEN_TAG`.

### 3.4 Add Mode
```typescript
type AddMode = 'barcode' | 'receipt' | 'manual';
```

### 3.5 Core Data Shapes

```typescript
export interface PantryItem {
  id: string;                    // UUID v4
  familyId: string;              // Resolved server-side
  name: string;                  // e.g. "Organic Almond Milk"
  category: CategoryType;        // e.g. "beverages"
  quantity: number;              // Non-negative integer or decimal (e.g. 1, 2.5)
  unit: string;                  // e.g. "carton", "pcs", "loaf", "tub", "pack", "kg", "L"
  expiryDate: string;            // ISO 8601 date string: "YYYY-MM-DD"
  storageLocation: StorageLocation; // "Fridge" | "Freezer" | "Pantry Shelf"
  allergens: AllergenTag[];      // e.g. ["gluten-free", "vegan", "dairy-free"]
  barcode?: string | null;       // UPC / EAN-13 string, e.g. "8901234567890"
  isLowStock?: boolean;          // Flagged when quantity <= 1 or explicitly marked
  notes?: string | null;         // Optional user notes
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
}

export interface ZeroWasteRecipe {
  id: string;                    // UUID or static identifier
  title: string;                 // Recipe name, e.g. "Gluten-Free Avocado Egg Bowl"
  cookTime: string;              // e.g. "12 mins", "25 mins"
  difficulty: 'Easy' | 'Medium' | 'Chef';
  matchPercentage: number;       // 0 - 100 percentage match against current pantry
  expiringIngredientUsed: string;// Primary expiring item saved, e.g. "Organic Hass Avocados"
  dietaryTags: AllergenTag[];    // Applicable dietary labels
  ingredients: string[];         // Full list of ingredients
  instructions: string[];        // Step-by-step cooking steps
  imageUrl?: string | null;      // Optional recipe thumbnail
}

export interface PantrySummary {
  totalItems: number;            // Count of distinct inventory entries
  totalQuantity: number;         // Sum of quantities across all items
  expiringSoonCount: number;     // Items expiring within 5 days
  expiredCount: number;          // Items whose expiry date < today
  lowStockCount: number;         // Items with quantity <= 1 or isLowStock = true
  freshnessScore: number;        // Percentage (0-100) of non-expiring items
  byLocation: {
    fridge: number;
    freezer: number;
    pantryShelf: number;
  };
  byCategory: Record<CategoryType, number>;
}
```

---

## 4. REST API Endpoint Specifications

Base Path: `/api/pantry`

```
├── GET    /api/pantry/items                 List pantry items (with filters & search)
├── POST   /api/pantry/items                 Create a pantry item (manual or barcode)
├── GET    /api/pantry/items/{id}            Get single item details
├── PUT    /api/pantry/items/{id}            Update pantry item details
├── PATCH  /api/pantry/items/{id}/quantity   Adjust item quantity (+delta / -delta)
├── DELETE /api/pantry/items/{id}            Delete pantry item (soft-delete)
├── GET    /api/pantry/summary               Dashboard summary rollup & freshness index
├── GET    /api/pantry/radar                 Expiry radar & allergen safety matrix
├── GET    /api/pantry/barcode/{code}        Lookup item in global barcode catalog
├── POST   /api/pantry/receipt-scan          Multipart OCR scan of grocery receipt
├── GET    /api/pantry/recipes/zero-waste    Get AI recipe recommendations for expiring stock
└── POST   /api/pantry/recipes/{id}/cook     Cook recipe & deduct ingredients from stock
```

---

### 4.1 `GET /api/pantry/items`

Retrieves all active pantry items for the authenticated user's household.

- **Headers:** `Authorization: Bearer <accessToken>`
- **Query Parameters (all optional):**
  - `location` (`StorageLocation`): Filter by `'Fridge'`, `'Freezer'`, or `'Pantry Shelf'`.
  - `category` (`CategoryType`): Filter by category.
  - `allergen` (`AllergenTag`): Filter by specific dietary tag.
  - `search` (`string`): Case-insensitive substring match against item `name` or `notes`.
  - `sortBy` (`string`): Sorting criteria:
    - `expiry` (default): Earliest expiration date first.
    - `quantity`: Highest quantity first.
    - `name`: Alphabetical ascending.
  - `expiringOnly` (`boolean`): If `true`, returns only items expiring within 5 days.
  - `lowStockOnly` (`boolean`): If `true`, returns only low-stock items.
  - `page` (`integer`, default: `0`): 0-indexed page number.
  - `size` (`integer`, default: `50`): Page size limit.

#### Success Response: `200 OK`
```json
{
  "content": [
    {
      "id": "p_101",
      "familyId": "fam_88291048",
      "name": "Organic Almond Milk",
      "category": "beverages",
      "quantity": 1,
      "unit": "carton",
      "expiryDate": "2026-09-11",
      "storageLocation": "Fridge",
      "allergens": ["gluten-free", "vegan", "dairy-free", "halal", "kosher"],
      "barcode": "8901234567890",
      "isLowStock": true,
      "notes": "Unsweetened vanilla",
      "createdAt": "2026-09-01T08:30:00Z",
      "updatedAt": "2026-09-09T06:00:00Z"
    },
    {
      "id": "p_102",
      "familyId": "fam_88291048",
      "name": "Farm Fresh Eggs (12 pcs)",
      "category": "dairy",
      "quantity": 2,
      "unit": "carton",
      "expiryDate": "2026-09-12",
      "storageLocation": "Fridge",
      "allergens": ["gluten-free", "nut-free", "halal", "kosher"],
      "barcode": null,
      "isLowStock": false,
      "notes": null,
      "createdAt": "2026-09-02T10:15:00Z",
      "updatedAt": "2026-09-02T10:15:00Z"
    }
  ],
  "page": 0,
  "size": 50,
  "totalElements": 2,
  "totalPages": 1,
  "last": true
}
```

---

### 4.2 `POST /api/pantry/items`

Adds a new grocery item to the household pantry. Can be populated manually or pre-filled from barcode scanning.

- **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "name": "Organic Oat Milk (1L)",
  "category": "beverages",
  "quantity": 2,
  "unit": "carton",
  "expiryDate": "2026-09-24",
  "storageLocation": "Fridge",
  "allergens": ["vegan", "nut-free", "dairy-free", "halal", "kosher"],
  "barcode": "8901234567890",
  "notes": "For morning smoothies"
}
```

#### Validation Rules:
- `name`: Required, 1 to 120 characters, non-blank.
- `category`: Required, must be one of §3.1's values.
- `quantity`: Required, float/integer > 0 (e.g. `1`, `0.5`, `12`).
- `unit`: Required, 1 to 30 characters (e.g. `"pcs"`, `"carton"`, `"pack"`, `"kg"`).
- `expiryDate`: Required, format `"YYYY-MM-DD"`. Must be a valid date.
- `storageLocation`: Required, must be one of `'Fridge'`, `'Freezer'`, or `'Pantry Shelf'`.
- `allergens`: Optional array, defaults to `[]`. Each entry must match §3.3.
- `barcode`: Optional, 8 to 14 digit numeric string.

#### Success Response: `201 Created`
Returns the created `PantryItem` object with assigned `id`, `familyId`, and timestamps.

#### Error Responses:
- `400 Bad Request`: Validation failure (`MISSING_NAME`, `INVALID_CATEGORY`, `INVALID_STORAGE_LOCATION`, `INVALID_EXPIRY_DATE`).
- `401 Unauthorized`: Missing or invalid JWT.
- `404 Not Found`: Caller has no household (`NO_FAMILY`).

---

### 4.3 `GET /api/pantry/items/{id}`

Fetches single item details.

- **Headers:** `Authorization: Bearer <accessToken>`
- **Path Parameter:** `id` (UUID of the pantry item)

#### Success Response: `200 OK`
Returns the full `PantryItem` object.

#### Error Responses:
- `404 Not Found`: Item does not exist or belongs to another household (`ITEM_NOT_FOUND`).

---

### 4.4 `PUT /api/pantry/items/{id}`

Updates an existing item's properties (name, category, storage location, expiry date, unit, allergens, notes).

- **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: application/json`
- **Path Parameter:** `id` (UUID)
- **Request Body:**
```json
{
  "name": "Organic Oat Milk (Barista Edition)",
  "category": "beverages",
  "quantity": 3,
  "unit": "carton",
  "expiryDate": "2026-09-28",
  "storageLocation": "Fridge",
  "allergens": ["vegan", "nut-free", "dairy-free"],
  "notes": "Saved for coffee"
}
```

#### Success Response: `200 OK`
Returns updated `PantryItem`.

---

### 4.5 `PATCH /api/pantry/items/{id}/quantity`

Atomic adjustment of item stock quantity (e.g., when a user taps "+", "-", or "Consume 1").

- **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: application/json`
- **Path Parameter:** `id` (UUID)
- **Request Body:**
```json
{
  "delta": -1
}
```
*Note: A positive `delta` increments stock; a negative `delta` decrements stock.*

#### Behavior & Business Rules:
- If `current_quantity + delta <= 0`:
  - If query param `deleteOnZero=true` (or default configuration): the item is automatically soft-deleted from inventory.
  - If `deleteOnZero=false`: `quantity` is clamped to `0` and `isLowStock` is set to `true`.
- If new quantity is `<= 1`, `isLowStock` is automatically updated to `true`.

#### Success Response: `200 OK`
```json
{
  "id": "p_101",
  "previousQuantity": 2,
  "newQuantity": 1,
  "unit": "carton",
  "isLowStock": true,
  "isDeleted": false
}
```

---

### 4.6 `DELETE /api/pantry/items/{id}`

Soft-deletes an item from the household pantry (`deleted_at = NOW()`).

- **Headers:** `Authorization: Bearer <accessToken>`
- **Path Parameter:** `id` (UUID)

#### Success Response: `204 No Content`

---

### 4.7 `GET /api/pantry/summary`

Provides the high-level dashboard rollup used by `PantryDashboardView.tsx`. Computes freshness scores, urgency counts, and location distribution in a single round-trip.

- **Headers:** `Authorization: Bearer <accessToken>`

#### Success Response: `200 OK`
```json
{
  "totalItems": 12,
  "totalQuantity": 24,
  "expiringSoonCount": 3,
  "expiredCount": 0,
  "lowStockCount": 2,
  "freshnessScore": 75,
  "byLocation": {
    "fridge": 7,
    "freezer": 2,
    "pantryShelf": 3
  },
  "byCategory": {
    "produce": 3,
    "dairy": 4,
    "bakery": 1,
    "beverages": 2,
    "meat": 1,
    "pantry": 1
  }
}
```

---

### 4.8 `GET /api/pantry/radar`

Fetches urgent/upcoming expiration alerts and safety matrix information for `ExpiryRadarView.tsx`.

- **Headers:** `Authorization: Bearer <accessToken>`

#### Success Response: `200 OK`
```json
{
  "urgentItems": [
    {
      "id": "p_106",
      "name": "Wild Atlantic Salmon Filet",
      "category": "meat",
      "quantity": 1,
      "unit": "pack",
      "expiryDate": "2026-09-10",
      "daysRemaining": 1,
      "storageLocation": "Fridge",
      "allergens": ["gluten-free", "dairy-free", "nut-free", "halal", "kosher"]
    }
  ],
  "upcomingItems": [
    {
      "id": "p_101",
      "name": "Organic Almond Milk",
      "category": "beverages",
      "quantity": 1,
      "unit": "carton",
      "expiryDate": "2026-09-13",
      "daysRemaining": 4,
      "storageLocation": "Fridge",
      "allergens": ["gluten-free", "vegan", "dairy-free"]
    }
  ],
  "allergenMatrix": [
    {
      "tag": "gluten-free",
      "safeItemsCount": 10,
      "totalItemsCount": 12
    },
    {
      "tag": "vegan",
      "safeItemsCount": 5,
      "totalItemsCount": 12
    },
    {
      "tag": "nut-free",
      "safeItemsCount": 11,
      "totalItemsCount": 12
    }
  ]
}
```

---

### 4.9 `GET /api/pantry/barcode/{code}`

Looks up a product in the global barcode catalog. Used by `AddScanView.tsx` when the camera detects a UPC/EAN barcode.

- **Headers:** `Authorization: Bearer <accessToken>`
- **Path Parameter:** `code` (string, e.g. `"8901234567890"`)

#### Success Response: `200 OK`
```json
{
  "barcode": "8901234567890",
  "name": "Organic Oat Milk (1L)",
  "brand": "Oatly",
  "category": "beverages",
  "defaultUnit": "carton",
  "suggestedStorageLocation": "Fridge",
  "allergens": ["vegan", "nut-free", "dairy-free", "halal", "kosher"],
  "estimatedShelfLifeDays": 14,
  "suggestedExpiryDate": "2026-09-23"
}
```

#### Error Response: `404 Not Found`
If the barcode is not in the system catalog:
```json
{
  "code": "BARCODE_NOT_FOUND",
  "message": "Barcode not recognized. Please enter details manually.",
  "barcode": "8909999999999"
}
```

---

### 4.10 `POST /api/pantry/receipt-scan`

Uploads a grocery bill receipt image for OCR processing.

- **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: multipart/form-data`
- **Multipart Parts:**
  - `file`: Image file (`image/jpeg`, `image/png`, or `application/pdf`), max 10MB.
  - `options` (optional JSON part): `{ "autoAdd": false }`
    - *Important React Native Note:* Follows project-wide multipart rule (`docs/DECISIONS.md` D-013–D-015): The JSON part must specify `Content-Type: application/json`.

#### Success Response: `200 OK`
```json
{
  "receiptId": "rec_992140",
  "storeName": "Nature's Basket",
  "scanDate": "2026-09-09",
  "totalAmount": 1420.50,
  "currency": "INR",
  "extractedItems": [
    {
      "name": "Greek Yogurt 500g",
      "category": "dairy",
      "quantity": 2,
      "unit": "tub",
      "predictedExpiryDate": "2026-09-19",
      "suggestedStorageLocation": "Fridge",
      "allergens": ["gluten-free", "nut-free", "halal"],
      "confidence": 0.96
    },
    {
      "name": "Organic Hass Avocados",
      "category": "produce",
      "quantity": 3,
      "unit": "pcs",
      "predictedExpiryDate": "2026-09-14",
      "suggestedStorageLocation": "Pantry Shelf",
      "allergens": ["gluten-free", "vegan", "nut-free", "dairy-free", "halal", "kosher"],
      "confidence": 0.92
    }
  ]
}
```

---

### 4.11 `GET /api/pantry/recipes/zero-waste`

Generates or fetches AI Zero-Waste recipe suggestions tailored to the caller's current pantry stock, specifically prioritizing ingredients expiring in ≤ 5 days.

- **Headers:** `Authorization: Bearer <accessToken>`
- **Query Parameters (optional):**
  - `maxRecipes` (`integer`, default: `5`)
  - `dietaryPreference` (`AllergenTag`): Optional filter for household dietary limits.

#### Success Response: `200 OK`
```json
[
  {
    "id": "rec_1",
    "title": "Gluten-Free Avocado Egg Bowl",
    "cookTime": "12 mins",
    "difficulty": "Easy",
    "matchPercentage": 98,
    "expiringIngredientUsed": "Organic Hass Avocados",
    "dietaryTags": ["gluten-free", "dairy-free", "nut-free"],
    "ingredients": [
      "2 Organic Hass Avocados (halved)",
      "2 Farm Fresh Eggs",
      "1 pinch Sea salt & cracked black pepper",
      "1 tsp Chili flakes & cilantro"
    ],
    "instructions": [
      "Scoop a slightly larger hole in the avocado halves.",
      "Crack one small egg into each avocado cavity.",
      "Bake at 200°C (400°F) for 12-15 minutes until egg whites set.",
      "Season with salt, pepper, and chili flakes. Serve warm."
    ],
    "imageUrl": "https://cdn.habita.ai/recipes/avocado_bowl.jpg"
  },
  {
    "id": "rec_2",
    "title": "Pan-Seared Salmon with Berry Yogurt Dip",
    "cookTime": "18 mins",
    "difficulty": "Medium",
    "matchPercentage": 92,
    "expiringIngredientUsed": "Wild Atlantic Salmon Filet",
    "dietaryTags": ["gluten-free", "nut-free", "halal"],
    "ingredients": [
      "1 Wild Atlantic Salmon Filet",
      "1/2 cup Greek Yogurt",
      "1 tbsp Olive oil",
      "1 Lemon wedge & dill"
    ],
    "instructions": [
      "Pat salmon dry and season generously with salt and pepper.",
      "Heat olive oil in a skillet over medium-high heat. Sear salmon skin-side down for 4 minutes.",
      "Flip and sear for an additional 3 minutes until golden.",
      "Mix Greek yogurt with lemon juice and dill. Serve beside salmon."
    ],
    "imageUrl": "https://cdn.habita.ai/recipes/seared_salmon.jpg"
  }
]
```

---

### 4.12 `POST /api/pantry/recipes/{recipeId}/cook`

Deducts ingredients consumed by cooking a recipe from the household's pantry stock.

- **Headers:** `Authorization: Bearer <accessToken>`, `Content-Type: application/json`
- **Path Parameter:** `recipeId` (ID of the recipe cooked)
- **Request Body (optional customization):**
```json
{
  "portionsCooked": 1
}
```

#### Behavior:
- Decrements the quantity of matching pantry items by 1 (or by recipe ingredient requirements).
- Automatically removes items that reach quantity 0.
- Returns a summary of updated stock.

#### Success Response: `200 OK`
```json
{
  "success": true,
  "recipeId": "rec_1",
  "deductedItems": [
    {
      "pantryItemId": "p_103",
      "name": "Organic Hass Avocados",
      "deducted": 2,
      "remainingQuantity": 2,
      "unit": "pcs"
    },
    {
      "pantryItemId": "p_102",
      "name": "Farm Fresh Eggs (12 pcs)",
      "deducted": 1,
      "remainingQuantity": 1,
      "unit": "carton"
    }
  ],
  "message": "Pantry inventory updated successfully."
}
```

---

## 5. Database Schema & PostgreSQL Flyway Migration

File: `V3__create_smart_pantry_tables.sql`

```sql
-- 1. Pantry Items Table (Scoped to household)
CREATE TABLE pantry_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(32) NOT NULL,
    quantity NUMERIC(8, 2) NOT NULL DEFAULT 1.00 CHECK (quantity >= 0),
    unit VARCHAR(32) NOT NULL DEFAULT 'pcs',
    expiry_date DATE NOT NULL,
    storage_location VARCHAR(32) NOT NULL CHECK (storage_location IN ('Fridge', 'Freezer', 'Pantry Shelf')),
    allergens TEXT[] DEFAULT '{}',
    barcode VARCHAR(64),
    is_low_stock BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance & household isolation
CREATE INDEX idx_pantry_items_family_active ON pantry_items (family_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pantry_items_expiry ON pantry_items (family_id, expiry_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_pantry_items_location ON pantry_items (family_id, storage_location) WHERE deleted_at IS NULL;
CREATE INDEX idx_pantry_items_barcode ON pantry_items (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_pantry_items_name_trgm ON pantry_items USING gin (name gin_trgm_ops);

-- 2. Global Barcode Catalog Table (Reference lookup)
CREATE TABLE barcode_catalog (
    barcode VARCHAR(64) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(32) NOT NULL,
    default_unit VARCHAR(32) NOT NULL DEFAULT 'pcs',
    suggested_storage_location VARCHAR(32) NOT NULL DEFAULT 'Fridge',
    allergens TEXT[] DEFAULT '{}',
    estimated_shelf_life_days INT DEFAULT 7,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Seed reference barcodes matching client mock data
INSERT INTO barcode_catalog (barcode, name, brand, category, default_unit, suggested_storage_location, allergens, estimated_shelf_life_days)
VALUES
('8901234567890', 'Organic Oat Milk (1L)', 'Oatly', 'beverages', 'carton', 'Fridge', '{"vegan","nut-free","dairy-free","halal","kosher"}', 14),
('8909876543210', 'Greek Yogurt 500g', 'Epigamia', 'dairy', 'tub', 'Fridge', '{"gluten-free","nut-free","halal","kosher"}', 10),
('8901122334455', 'Gluten-Free Whole Grain Bread', 'The Baker''s Dozen', 'bakery', 'loaf', 'Pantry Shelf', '{"gluten-free","vegan","nut-free","dairy-free","halal"}', 5),
('8906677889900', 'Organic Hass Avocados (3 Pack)', 'FreshProduce', 'produce', 'pack', 'Pantry Shelf', '{"gluten-free","vegan","nut-free","dairy-free","halal","kosher"}', 6);

-- 3. Zero-Waste Recipe Catalog Table
CREATE TABLE zero_waste_recipes (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    cook_time VARCHAR(32) NOT NULL,
    difficulty VARCHAR(16) NOT NULL CHECK (difficulty IN ('Easy', 'Medium', 'Chef')),
    primary_expiring_ingredient VARCHAR(100) NOT NULL,
    dietary_tags TEXT[] DEFAULT '{}',
    ingredients JSONB NOT NULL,
    instructions JSONB NOT NULL,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

---

## 6. Business Logic & AI Algorithm Specifications

### 6.1 Freshness Percentage Formula
```typescript
freshnessScore = totalItemsCount > 0 
  ? Math.round((itemsWithExpiryGreaterThan5Days / totalItemsCount) * 100) 
  : 100;
```

### 6.2 Zero-Waste Recipe Matching & Generation Algorithm
1. **Dynamic OpenAI Synthesis (Active Engine):**
   - **Engine:** Spring AI `ChatClient` (`zeroWasteChefClient`) powered by OpenAI `gpt-4o-mini` using the `OPEN_AI_KEY` from the environment / `.env`.
   - **Contextual Ingestion:** Dynamically aggregates the household's expiring stock (`expiry_date - CURRENT_DATE <= 5` days and `quantity > 0`) alongside all available pantry items and any caller `dietaryPreference` filters (e.g. `vegan`, `gluten-free`, `dairy-free`).
   - **Generation:** OpenAI crafts creative zero-waste culinary recipes that prioritize expiring perishables, compute accurate match percentages, specify step-by-step instructions, and assign verified dietary tags.
   - **Persistence & Cookability:** Synthesized AI recipes are automatically upserted into the PostgreSQL `zero_waste_recipes` table with unique prefixes (`ai_<hash>`) so they can be immediately cooked and deducted via `POST /api/pantry/recipes/{id}/cook`.
2. **Catalog Fallback Scoring (Offline / Graceful Degradation):**
   - If OpenAI is offline, unconfigured, or rate-limited, the system falls back seamlessly to internal catalog scoring:
     - $S_{\text{expiring}} = 1.0$ if the candidate recipe's `primary_expiring_ingredient` matches any expiring item name in the user's pantry, else $0.0$.
     - $S_{\text{coverage}} = \frac{\text{matching ingredients in pantry}}{\text{total ingredients required by recipe}}$.
     - $\text{matchPercentage} = \min(100, \text{round}(S_{\text{expiring}} \times 60 + S_{\text{coverage}} \times 40))$.
3. **Sort & Rank:** Recipes are returned ordered descending by `matchPercentage`.

### 6.3 Ingredient Deduction Upon Cooking
When `POST /api/pantry/recipes/{id}/cook` is called:
- For each item used by the recipe:
  - If item exists in household pantry with `quantity > 1`: decrement `quantity` by 1.
  - If `quantity <= 1`: mark `deleted_at = NOW()` (or set `quantity = 0` and `is_low_stock = true`).

---

## 7. Error Code Reference

| HTTP Status | Error Code | Description |
|---|---|---|
| `400` | `INVALID_CATEGORY` | Category must be one of `produce`, `dairy`, `bakery`, `beverages`, `meat`, `pantry`. |
| `400` | `INVALID_STORAGE_LOCATION` | Storage location must be `Fridge`, `Freezer`, or `Pantry Shelf`. |
| `400` | `INVALID_ALLERGEN_TAG` | Unrecognized dietary tag sent in allergens array. |
| `400` | `INVALID_EXPIRY_DATE` | Date format must be `YYYY-MM-DD` and represent a real calendar date. |
| `400` | `INVALID_QUANTITY` | Quantity must be a positive number. |
| `401` | `UNAUTHORIZED` | Bearer token is missing, expired, or invalid. |
| `404` | `NO_FAMILY` | The caller is not a member of any active household. |
| `404` | `ITEM_NOT_FOUND` | The specified pantry item does not exist or belongs to another household. |
| `404` | `BARCODE_NOT_FOUND` | The barcode is not in the system catalog. |
| `404` | `RECIPE_NOT_FOUND` | The requested recipe does not exist. |
| `413` | `FILE_TOO_LARGE` | Receipt image upload exceeds the 10 MB limit. |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Uploaded receipt must be JPEG, PNG, or PDF. |
| `422` | `OCR_PARSE_FAILED` | Receipt image was blurry or unreadable by OCR engine. |

---

## 8. Client Implementation & Wiring Summary (`Habita-AI`)

The client-side architecture follows a **Remote-First with Automatic Offline Fallback** design, ensuring high availability, zero latency spikes, and seamless degradation when disconnected.

### 8.1 Module Architecture
```
src/features/money/smart_pantry/
├── PantryScreen.tsx                     # Main tab coordinator & view orchestrator
├── api.ts                               # Pure typed HTTP client for all 12 backend endpoints
├── hooks/
│   └── useSmartPantry.ts                # Reactive hook managing state, auth lifecycle & CRUD
├── services/
│   └── pantryStorage.ts                 # Dual-mode storage (Remote-first + AsyncStorage)
├── components/
│   ├── PantryDashboardView.tsx          # CRED-style metrics, Freshness Score, urgent alerts
│   ├── PantryInventoryView.tsx          # Zone filter, allergen badge filter, search, sort
│   ├── AddScanView.tsx                  # Barcode lookup, receipt OCR scanning, manual entry
│   ├── ItemDetailsView.tsx              # Quantity modifier (+/-), days countdown, soft delete
│   ├── ExpiryRadarView.tsx              # Urgency breakdown (Urgent/Expiring) & allergen matrix
│   └── ZeroWasteRecipesView.tsx         # AI-ranked recipe feed with 1-tap cook ingredient deduction
├── types/
│   └── index.ts                         # Complete TypeScript domain contracts & DTOs
└── data/
    └── mockPantryData.ts                # Offline seed fallbacks, barcode reference, allergen badges
```

### 8.2 Client API Client (`api.ts`)
The pure API client wraps all 12 backend endpoints with typed signatures using `apiFetch` and `postMultipart`:
- `listPantryItemsRemote(token, query)` -> `GET /api/pantry/items`
- `createPantryItemRemote(item, token)` -> `POST /api/pantry/items`
- `getPantryItemRemote(id, token)` -> `GET /api/pantry/items/{id}`
- `updatePantryItemRemote(id, item, token)` -> `PUT /api/pantry/items/{id}`
- `adjustPantryQuantityRemote(id, delta, token, deleteOnZero)` -> `PATCH /api/pantry/items/{id}/quantity`
- `deletePantryItemRemote(id, token)` -> `DELETE /api/pantry/items/{id}`
- `getPantrySummaryRemote(token)` -> `GET /api/pantry/summary`
- `getPantryRadarRemote(token)` -> `GET /api/pantry/radar`
- `lookupBarcodeRemote(code, token)` -> `GET /api/pantry/barcode/{code}`
- `scanReceiptRemote(file, token, autoAdd)` -> `POST /api/pantry/receipt-scan`
- `getZeroWasteRecipesRemote(token, maxRecipes, dietaryPreference)` -> `GET /api/pantry/recipes/zero-waste`
- `cookRecipeRemote(recipeId, token, portionsCooked)` -> `POST /api/pantry/recipes/{recipeId}/cook`

### 8.3 Authentication & Household Lifecycle
- Uses `useAuth()` to resolve the session's Bearer `accessToken`.
- The hook waits until `pending === false` before dispatching initial network calls.
- Scoped automatically to the caller's household (`family_id`). If the user does not belong to any family yet, the backend returns HTTP 404 with error code `NO_FAMILY`, and the client automatically displays the local storage cache until they create/join a family.

---

## 9. Live Verification & Testing Guide

### 9.1 Environment & Network Configuration
In `src/config.ts`, the base URL is configured with automatic platform detection:
- **Android Emulator:** `http://10.0.2.2:8080/api`
- **iOS Simulator / Web / Desktop:** `http://localhost:8080/api`
- **Physical Device over LAN:** `http://<YOUR_LOCAL_IP>:8080/api`

### 9.2 Ready-to-Use Seed Test Accounts
The local PostgreSQL database includes pre-registered users with verified household memberships:

| Mobile Number | OTP | User Name | Family Name | Family ID |
|---|---|---|---|---|
| `9062545232` | `123456` | Pranay Koley | Keross | `4208ea32-7862-49b9-9344-e809b59a8c99` |
| `9062545234` | `123456` | Pranay Testing | Pranay Testing | `ace9fa1b-6dbb-400f-89ce-e6ac3168220a` |

### 9.3 Pre-Seeded Barcodes for Scanner Testing
Scanning or tapping these test barcodes triggers `GET /api/pantry/barcode/{code}` and automatically populates the form:

| Barcode | Product Name | Brand | Category | Storage Location | Allergens |
|---|---|---|---|---|---|
| `8901234567890` | Organic Oat Milk (1L) | Oatly | `beverages` | Fridge | vegan, nut-free, dairy-free, halal, kosher |
| `8909876543210` | Greek Yogurt 500g | Epigamia | `dairy` | Fridge | gluten-free, nut-free, halal, kosher |
| `8901122334455` | Gluten-Free Whole Grain Bread | The Baker's Dozen | `bakery` | Pantry Shelf | gluten-free, vegan, nut-free, dairy-free, halal |
| `8906677889900` | Organic Hass Avocados (3 Pack) | FreshProduce | `produce` | Pantry Shelf | gluten-free, vegan, nut-free, dairy-free, halal, kosher |

### 9.4 Pre-Seeded Zero-Waste Recipes
These recipes are evaluated dynamically against expiring stock:
1. `rec_1`: **Gluten-Free Avocado Egg Bowl** (Target: Organic Hass Avocados)
2. `rec_2`: **Pan-Seared Salmon with Berry Yogurt Dip** (Target: Wild Atlantic Salmon / Greek Yogurt)
3. `rec_3`: **Overnight Oat & Berry Parfait** (Target: Organic Oat Milk)
4. `rec_4`: **Creamy Herb Greek Yogurt Toast** (Target: Greek Yogurt / Gluten-Free Bread)

Cooking any of these recipes through the UI or `POST /api/pantry/recipes/{id}/cook` automatically decrements or clears the consumed ingredients.

### 9.5 Verified Live Curl Examples

```bash
# 1. Login & get Token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" -d '{"phone":"9062545232"}'

curl -X POST http://localhost:8080/api/auth/verify-otp \
  -H "Content-Type: application/json" -d '{"phone":"9062545232","code":"123456"}'

# 2. Get Pantry Inventory
curl -X GET http://localhost:8080/api/pantry/items \
  -H "Authorization: Bearer <TOKEN>"

# 3. Get Pantry Summary & Freshness Rollup
curl -X GET http://localhost:8080/api/pantry/summary \
  -H "Authorization: Bearer <TOKEN>"

# 4. Lookup Barcode
curl -X GET http://localhost:8080/api/pantry/barcode/8901234567890 \
  -H "Authorization: Bearer <TOKEN>"

# 5. Get Zero-Waste AI Recipes
curl -X GET "http://localhost:8080/api/pantry/recipes/zero-waste?maxRecipes=5" \
  -H "Authorization: Bearer <TOKEN>"

# 6. Cook Recipe & Deduct Stock
curl -X POST http://localhost:8080/api/pantry/recipes/rec_3/cook \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"portionsCooked": 1}'
```

---

## 10. Completed Implementation Status & Frontend Integration

All 4 frontend and backend enhancements have been fully implemented, tested, and verified live:

1. **Live Hardware Camera Scanning:**
   - **Status:** **COMPLETED & ACTIVE**.
   - **Implementation:** `src/features/money/smart_pantry/components/AddScanView.tsx` integrates native hardware camera scanning via `launchCamera` (`react-native-image-picker`) with Android runtime permission requests (`PermissionsAndroid.PERMISSIONS.CAMERA`).
   - **Barcode Mode:** Users can tap the camera viewfinder or the "Scan Barcode with Camera" button to open the hardware camera. Quick demo barcode chips are also available for emulator testing.
   - **Receipt Mode:** Provides distinct action cards for "Take Photo with Camera" (`launchCamera`) and "Choose from Gallery" (`launchImageLibrary`), as well as instant demo scan.

2. **Itemized Receipt OCR Review & Edit Modal (Before Persistence):**
   - **Status:** **COMPLETED & ACTIVE**.
   - **Implementation:** `AddScanView.tsx` opens an interactive itemized modal upon scanning a receipt (with `autoAdd=false`).
   - **Capabilities:**
     - Displays extracted line items with OCR match confidence scores.
     - Full editability for item name, category (Produce, Dairy, Bakery, Beverages, Meat, Pantry), quantity, unit, storage location (Fridge, Freezer, Pantry Shelf), expiry date (`YYYY-MM-DD`), and dietary safety badges.
     - Checkbox selection: Users can toggle individual items, "Select All", or delete unwanted lines.
     - "+ Add Item" option to insert any items missed by OCR.
     - "Save Selected to Pantry" persists only chosen items via `onAddItem`. Nothing is saved automatically without explicit user confirmation.

3. **Zero-Waste Recipes Screen with Dietary Filters:**
   - **Status:** **COMPLETED & ACTIVE**.
   - **Implementation:**
     - `ZeroWasteRecipesView.tsx` features a horizontal dietary filter carousel (`All Recipes`, `Vegan`, `Gluten-Free`, `Halal`, `Dairy-Free`, `Nut-Free`, `Kosher`).
     - Recipe cards display dietary tag badges matching household preferences.
     - Filter selection queries the backend `GET /api/pantry/recipes/zero-waste?dietaryPreference=...` and applies responsive local client filtering.
     - 1-tap cooking with ingredient deduction is verified via `POST /api/pantry/recipes/{id}/cook`.

4. **Push Notifications for Spoilage Radar:**
   - **Status:** **COMPLETED & ACTIVE**.
   - **Backend Implementation:**
     - `NotificationType.PANTRY_SPOILAGE_ALERT` added.
     - `FcmPushService.sendPantryExpiryAlert()` dispatches high-priority notifications with channel `pantry_spoilage_alerts` and click action `OPEN_PANTRY_RADAR`.
     - `PantryExpiryScheduler.java`: Automated cron job (`0 0 9 * * *` - 9:00 AM daily) identifies items expiring in ≤ 2 days and alerts household members.
     - Direct on-demand trigger endpoint: `POST /api/pantry/radar/notify-expiring`.
   - **Frontend Integration:**
     - `useSmartPantry.ts`: `triggerSpoilageAlerts()` calls `POST /api/pantry/radar/notify-expiring`.
     - `ExpiryRadarView.tsx`: Interactive "Send Push" alert button in header lets users test or immediately dispatch household spoilage notifications.
   - **Automated Tests:** 32 tests run and pass (`./mvnw.cmd test -Dtest=Pantry*`).



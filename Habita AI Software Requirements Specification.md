# **Software Requirements Specification (SRS)**

## **Project Name: Habita AI (Global Home & Life Operating System)**

**Document Version:** 3.0

**Target Architecture:** Enterprise Spring Boot 3.x \+ PostgreSQL (Java 21 LTS)

**Target Client Ecosystem:** React Native / Expo Cross-Platform Applications (iOS & Android)

## **1\. Executive Summary & Strategic Vision**

### **1.1 Brand & Value Proposition**

**Habita AI** is an all-in-one, global **"Home & Life Operating System"** designed to unify household administration, wellness, caregiving, domestic finance, and personal logistics into an ambient, intelligent co-pilot.

The platform synthesizes three foundational pillars:

* **Habitat:** Domestic operations, physical asset management, service providers, and household logistics.  
* **Habit:** Daily routines, cycle/hormonal health tracking, mental well-being, and preventive health logs.  
* **AI Engine:** Ambient intelligence that converts unstructured inputs (voice commands, receipts, pharmacy bills, documents) into structured, actionable household workflows.

### **1.2 Global Market Strategy**

Habita AI addresses a massive, underserved global consumer market at the intersection of **FamTech (Family Technology)**, **FemTech**, and **Personal Productivity Tech**:

1. **High-Frequency Emerging Markets (e.g., India & South Asia):** Captures high user retention through specialized hyper-local features, including real-time domestic staff management (payroll, attendance, advances), instant UPI payments, localized event planning, and multi-generational dependent care.  
2. **High-ARPU International Markets (e.g., North America, Europe, APAC):** Drives premium monetisation through global caregiver logistics (nannies, eldercare, pet sitters), multi-currency split-ledger engines, global gateway integrations (Stripe/PayPal), barcode/allergen intelligence, cross-border document vaults, and wearable biometric syncing.

### **1.3 Platform Architecture & Enterprise Readiness**

The Habita AI backend is engineered as a high-performance, stateless micro-monolith running on **Java 21 LTS**, **Spring Boot 3.3+**, and **PostgreSQL 16+**. The platform provides:

* **Bank-Grade Data Integrity:** Strict relational foreign key constraints, automated cascade rules, and schema version control via Flyway.  
* **Zero-Trust Security & Compliance:** Standardized JWT-based context resolution, encrypted document storage, role-based access control (RBAC), and SOC2/GDPR-compliant audit logging.  
* **Ambient Cognitive Processing:** Multi-LLM integration (OpenAI & Google Gemini) utilizing native structured outputs (json\_schema) for reliable, deterministic automated actions.

## **2\. Platform Architecture & Enterprise Technology Stack**

┌────────────────────────────────────────────────────────────────────────┐  
│                        HABITA AI ENTERPRISE STACK                      │  
├────────────────────────────────────────────────────────────────────────┤  
│  Clients: Mobile App (React Native / Expo) │ Web Portal │ Wearables    │  
├────────────────────────────────────────────────────────────────────────┤  
│  API Gateway & Security Layer (Spring Security 6 \+ JWT \+ RBAC)         │  
├────────────────────────────────────────────────────────────────────────┤  
│  Application Core (Java 21 LTS / Spring Boot 3.3 / MapStruct)          │  
│  ├─ Auth & Identity       ├─ Health & Wellness   ├─ Household Ops    │  
│  ├─ Caregiver Ledger     ├─ Global Finance      ├─ Intelligence OS  │  
├────────────────────────────────────────────────────────────────────────┤  
│  Cognitive Layer: Multi-LLM Orchestrator (OpenAI GPT-4o / Gemini 2.5)  │  
├────────────────────────────────────────────────────────────────────────┤  
│  Data Layer: PostgreSQL 16+ (JPA / Hibernate / Flyway Mappings)        │  
└────────────────────────────────────────────────────────────────────────┘

### **2.1 Technology Infrastructure Specifications**

* **Runtime Environment:** Java 21 LTS (Virtual Threads enabled for massive concurrent I/O throughput).  
* **Application Framework:** Spring Boot 3.3+ utilizing Kotlin DSL (build.gradle.kts) for optimized build efficiency.  
* **Primary Relational Store:** PostgreSQL 16+ with pg\_trgm extension enabled for ultra-fast fuzzy search and matching.  
* **Data Access & Persistence:** Spring Data JPA with Hibernate ORM and Flyway automated schema version management.  
* **DTO Mapping Engine:** MapStruct (compile-time code generation eliminating reflection overhead).  
* **Security Layer:** Stateless Spring Security 6 with HS256/RS256 JWT execution.

### **2.2 Modular Domain Architecture**

The backend uses a modular domain layout inside the com.habita root package to promote loose coupling and clear domain boundaries:

com.habita  
├── common/             \# Shared Base Entities, Global Exception Handlers, Standard DTOs  
├── config/             \# Asynchronous, WebClient, OpenApi, and Security Configurations  
├── security/           \# JwtService, SecurityFilters, @CurrentUser Resolver  
├── ai/                 \# LlmClientService (OpenAI & Gemini Structured Binding Engine)  
├── auth/               \# Core Identity, User Profiles, Managed Members (Dependents)  
├── family/             \# Family Multi-Tenancy Hub, Cross-Tenant Permission Rules  
├── pantry/             \# Inventory Logistics, Barcode/Receipt Scans, Expiry Engine  
├── wardrobe/           \# Closet Management, Weather-Adaptive AI Mirror  
├── wellness/           \# Mood Tracking, AI CBT Coaching, Static Meditations  
├── medchest/           \# Health Profiles, Medicine Inventory, Intake Tracking, Health Docs  
├── staff/              \# Caregivers, Domestic Staff, Attendance, Payroll & Transactions  
├── resources/          \# Utility Tracking, Quick-Tap Counters, Bill Scanners  
├── events/             \# Shared Family Event Budgeting, Calendar Integration  
├── vehicles/           \# Asset Vault, Maintenance Timelines, Expenses  
├── cycle/              \# Hormonal Health, Cycle Intelligence, Life-Stage Advice  
├── voice/              \# Spoken Intent Orchestrator & Natural Language Processor  
├── expensegroups/      \# Multi-Currency Bill Splitting, Group Ledgers, Settlements  
├── dashboard/          \# Aggregated Real-Time Household Feeds & Briefings  
├── payments/           \# Subscription Plans, Webhooks, Razorpay, Stripe, PayPal Gateways  
├── dochub/             \# Central Document Vault, Visa/Passport Expiration Trackers  
├── upi/                \# Local Real-Time Payment Rails (India VPA / Deep-Links)  
└── admin/              \# Audit Trails, User Activity Monitoring, Administrative Analytics

### **2.3 Data Governance & Account Isolation Protocol**

To enforce strict privacy and compliance guarantees across multi-tenant family structures:

* Every user-owned domain entity enforces explicit @ManyToOne(fetch \= FetchType.LAZY) User user bindings.  
* **Database-Level Data Purging:** Flyway DDL specifications mandate ON DELETE CASCADE constraints across all user tables. Requesting an account deletion executes a single cascading operation at the database level, guaranteeing complete data erasure for privacy regulations (GDPR "Right to be Forgotten").  
* **Immutable Compliance Archives:** Financial transaction logs (PaymentEvent) and administrative audit trails (AuditLog) are explicitly excluded from cascading deletion rules to satisfy financial auditing compliance.

## **3\. Security, Multi-Tenancy & Artificial Intelligence**

### **3.1 Identity & Access Management (IAM)**

Stateless security is enforced across all API endpoints:

* **Token Specification:** Cryptographically signed JWTs containing sub (User UUID), phone, iat, and exp (30-day TTL).  
* **Context Resolution:** Controller endpoints consume authenticated user contexts via a native @CurrentUser User user parameter resolver, ensuring verified identity injection without trusting raw request headers.  
* **Administrative Guardrails:** Administrative API paths (/api/admin/\*\*) are isolated behind a secondary SecurityFilterChain requiring administrative JWT role claims (role=admin) or static security keys (ADMIN\_KEY).

### **3.2 AI Core Engine (LlmClientService)**

All platform intelligence is routed through a central LlmClientService utilizing Spring WebClient integrations with OpenAI (gpt-4o-mini) and Google Gemini (2.5-flash):

* **Deterministic Structured Output:** Requests leverage strict JSON Schema bindings (json\_schema for OpenAI, responseSchema for Gemini), eliminating non-deterministic text responses.  
* **Operational Scope:** Powers receipt OCR, pharmacy bill parsing, pantry meal suggestions, weather-and-event style matching, CBT mental health coaching, cycle advice generation, and real-time voice intent classification.

## **4\. Operational Modules & Feature Specifications**

### **Module Group 1: Core Foundation & Identity Management**

#### **1\. Identity & Managed Members**

* **Entities:** User, UserProfile, OtpCode, ManagedMember.  
* **Capabilities:** Universal phone-based authentication (E.164 standard) with OTP generation. Manages non-autonomous dependents (children, elderly family members, pets) through ManagedMember records linked directly to the primary account holder.

#### **2\. Multi-Tenant Family Sharing**

* **Entities:** Family, FamilyMember.  
* **Capabilities:** Supports shared household groups (up to 5 members). Features a flexible permission matrix stored in PostgreSQL jsonb format.  
* **Cross-Tenant Access Control:** The specialized FamilyAccessService evaluates explicit cross-account permissions (resolveReadableAndWritableUserIds), enabling selective sharing of medical files and home documents across family members while keeping personal health data private.

#### **3\. Administrative Analytics & Governance**

* **Entities:** AuditLog, UserActivity.  
* **Capabilities:** Tracks system activity, compliance events, and user engagement metrics. UserActivity implements composite unique keys (user\_id, date) to support efficient, non-blocking asynchronous upsert operations.

### **Module Group 2: Personal Health, Wellness & Life-Stage Suite**

┌────────────────────────────────────────────────────────────────────────┐  
│                      HABITA AI PERSONAL HEALTH HUB                     │  
│                                                                        │  
│   ┌─────────────────┐             ┌─────────────────────────────────┐  │  
│   │ FamilyProfile   │◄───────────┤ Medicine                        │  │  
│   │ (Self/Elder/Kid)│             │ (Schedule/Stock/Allergens)     │  │  
│   └─────────────────┘             └───────────────┬─────────────────┘  │  
│                                                   │                    │  
│                                           ┌───────▼─────────┐          │  
│                                           │ IntakeLog       │          │  
│                                           └─────────────────┘          │  
└────────────────────────────────────────────────────────────────────────┘

#### **4\. Integrated Medical Chest & Prescriptions**

* **Entities:** FamilyProfile, Medicine, IntakeLog, MedicalDocument.  
* **Capabilities:** Unifies family prescription tracking, dosing schedules, and remaining pill stock counts. Uses AI OCR to parse pharmacy bills and medication labels. Integrates with Apple HealthKit and Google Health Connect to capture biometric data (heart rate, temperature, sleep).

#### **5\. Mental Health & CBT Coaching**

* **Entities:** MoodEntry.  
* **Capabilities:** Real-time mood logging paired with an empathetic AI CBT Assistant that offers personalized emotional support and stress-reduction guidance. Delivers structured multi-language meditation guides.

#### **6\. Hormonal Health & Life-Stage Tracking**

* **Entities:** PeriodCycle.  
* **Capabilities:** Tracks menstrual cycles, predicts upcoming phases, and sends proactive notifications. Features dedicated support for fertility planning, postpartum recovery, perimenopause, and menopause, complete with tailored nutrition and exercise suggestions.

### **Module Group 3: Household Ledger & Asset Operations**

#### **7\. Caregiver & Home Services Hub**

* **Entities:** Caregiver, Attendance, CaregiverTransaction.  
* **Capabilities:** Manages both local domestic staff (maids, cooks, drivers) and global service providers (nannies, babysitters, eldercare aides, pet sitters). Supports hourly rates, monthly salaries, overtime calculations, cash advances, and tipping. Generates formatted summaries for contractor tax reporting.

#### **8\. Resource & Utility Logistics**

* **Entities:** ResourceLog, QuickTapItem.  
* **Capabilities:** Tracks recurring deliveries (water, milk, bottled supplies). Offers single-tap dashboard counters for rapid logging. Automatically extracts total amounts and due dates from uploaded utility bills using AI OCR.

#### **9\. Shared Family Events & Budgeting**

* **Entities:** EventFolder, EventExpense.  
* **Capabilities:** Manages budgets and expense items for family celebrations, holidays, and birthday parties. Integrates bidirectionally with shared Google and Apple family calendars.

#### **10\. Property Asset Vault & Vehicle Upkeep**

* **Entities:** Vehicle, VehicleDocument, VehicleExpense.  
* **Capabilities:** Logs vehicle maintenance histories, fuel efficiency, and insurance renewal dates. Serves as a comprehensive **Home Asset Vault** to track appliance warranties, serial numbers, manuals, and home maintenance tasks (e.g., HVAC filter changes).

### **Module Group 4: Global Finance, Commerce & Intelligence**

#### **11\. Multi-Currency Expense Groups**

* **Entities:** ExpenseGroup, GroupMember, GroupExpense, Settlement.  
* **Capabilities:** Shared bill splitting with support for real-time multi-currency conversions. Stores dynamic weighted splits in structured jsonb format and includes soft-delete capabilities to maintain clear historical balance audits.

#### **12\. Payment Rails & Global Subscriptions**

* **Entities:** RzpPlan, Subscription, PaymentEvent, UpiPayee, UpiTransaction.  
* **Capabilities:** Unified subscription billing handling **Razorpay** (for South Asia) alongside **Stripe and PayPal** (for global markets). Features cryptographic webhook signature validation and isolated environment controls for testing. Supports both regional VPAs (India UPI) and standard global payment routes (IBAN/ACH/SWIFT).

#### **13\. Household Document Hub**

* **Entities:** DocHubEntry.  
* **Capabilities:** Secure household document repository protected by FamilyAccessService permission checks. Features pre-built templates for passports, visas, driver's licenses, and international health insurance, complete with automated expiration warnings.

#### **14\. Smart Pantry & Allergen Radar**

* **Entities:** PantryItem.  
* **Capabilities:** Tracks grocery inventory using barcode and receipt scanning. **Allergen Radar** automatically flags items matching dietary requirements (Gluten-Free, Vegan, Halal, Kosher, Nut Allergies). An **Expiry Engine** alerts users before food spoils and suggests zero-waste recipes using available stock.

#### **15\. Wardrobe & Weather-Adaptive Style Mirror**

* **Entities:** WardrobeItem.  
* **Capabilities:** Digital closet organization with secure photo storage. An AI "Style Mirror" suggests outfit combinations based on local weather forecasts and upcoming calendar commitments.

#### **16\. Voice Command & Orchestration Engine**

* **Entities:** None (Service-Only Layer).  
* **Voice Command (VoiceCommandService):** Uses LlmClientService to analyze spoken intent and direct actions to relevant modules. Utilizes PostgreSQL pg\_trgm indexes for fast fuzzy text matching on inventory and contact names.  
* **Home Dashboard (HomeDashboardService):** Combines cross-module metrics (low stock warnings, upcoming bills, medication reminders, pending balances) into a single personalized feed, optimized with a 30-second Spring @Cacheable caching layer.

## **5\. Enterprise Schema Migration Plan (Flyway)**

V1\_auth\_and\_profiles.sql      ──► Core Identity, User Profiles & Family Base  
V2\_family\_sharing.sql          ──► Multi-Tenancy Mappings & Access Rules  
V3\_pantry\_sustainability.sql   ──► Pantry Inventory, Barcodes & Expiry Engine  
V4\_wardrobe\_style.sql          ──► Digital Closet & AI Style Mirror  
V5\_wellness\_cbt.sql            ──► Mood Tracking & CBT Conversation Logs  
V6\_caregiver\_medchest.sql      ──► Dependents, Prescription Inventory & Health Docs  
V7\_caregiver\_staff.sql         ──► Caregiver Profiles, Attendance & Ledger  
V8\_resources\_utilities.sql     ──► Utility Logs & Quick-Tap Counters  
V9\_events\_calendar.sql         ──► Event Folders & Shared Budget Line Items  
V10\_vehicles\_property.sql      ──► Vehicle Records, Property Vault & Warranties  
V11\_cycle\_hormonal.sql         ──► Cycle Tracking & Life-Stage Records  
V12\_expense\_groups.sql         ──► Split Ledgers, Weightings & Settlements  
V13\_payments\_global.sql        ──► Subscriptions, Webhooks & Global Gateways  
V14\_doc\_hub.sql                ──► Encrypted Document Vault & Templates  
V15\_upi\_rail.sql               ──► Local Payment VPA Registries  
V16\_admin\_analytics.sql        ──► Immutable Audit Trails & System Metrics  
V17\_foreign\_keys\_cascades.sql  ──► Cross-System Cascading Foreign Keys  
V18\_trigram\_indexes.sql        ──► Global Search Indexes & Fuzzy Text Triggers

## **6\. API Ecosystem Summary (123 Controllers)**

All API routes are served under standardized /api/\*\* endpoints:

| Domain | Controller Route | Key Platform Functions |
| :---- | :---- | :---- |
| **Auth** | /api/auth, /api/managed-members | Authentication, JWT issuing, dependent management. |
| **Pantry** | /api/pantry, /api/recipes | Inventory CRUD, barcode/receipt scanning, recipe engine. |
| **Wardrobe** | /api/style | Closet management, weather-adaptive outfit advice. |
| **Wellness** | /api/wellness | Mood tracking, AI CBT coaching, guided meditations. |
| **Caregivers** | /api/staff | Contractor/staff attendance, salary & wage processing. |
| **Resources** | /api/resources | Utility tracking, rapid counter taps, bill parsing. |
| **Events** | /api/events | Event budgeting, shared expense tracking, calendar sync. |
| **MedChest** | /api/medicine-chest, /api/documents | Medication tracking, adherence logs, pharmacy OCR. |
| **Property/Assets** | /api/vehicles | Vehicle upkeep, appliance warranties, asset logs. |
| **Cycle** | /api/cycle | Hormonal health, cycle prediction, nutritional advice. |
| **Voice** | /api/voice | Spoken intent parsing and cross-module execution. |
| **Expenses** | /api/expense-groups | Dynamic bill splitting, settlements, balance tracking. |
| **Dashboard** | /api/home | Aggregated real-time briefing feed and alerts. |
| **Payments** | /api/payments | Global subscriptions, Stripe/Razorpay webhooks. |
| **DocHub** | /api/docs | Cross-border document vault, expiration tracking. |
| **Family** | /api/family | Household multi-tenancy rules and permissions. |
| **UPI** | /api/upi | Regional VPA validation and deep-link generation. |
| **Admin** | /api/admin | Audit trails, platform analytics, system metrics. |
| **Account** | /api/account | Self-service cascading account erasure. |

## **7\. Operational Readiness & Quality Assurance**

1. **Automated Testing & API Verification:** Execute automated integration test suites against the Spring Boot deployment to confirm response format consistency and strict status code compliance across all 123 endpoints.  
2. **Data Integrity Audit:** Verify that executing a user deletion command cleanly removes dependent entries across all 17 domain schema files while preserving immutable compliance records (AuditLog, PaymentEvent).  
3. **Structured Payload Validation:** Ensure all 14 AI-backed service endpoints process valid JSON payloads from OpenAI and Gemini without falling back to plain-text regex parsing.
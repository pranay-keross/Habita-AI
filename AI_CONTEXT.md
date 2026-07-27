# Saheli CLI - AI Master Context & Architecture Guide

> **Note for AI Models / Agents**: This document serves as the single source of truth for the **Saheli** React Native codebase. Any AI model or coding assistant reading this file can instantly understand the application purpose, architectural structure, completed features, pending roadmap, and design system rules without requiring user re-explanation.

---

## 1. Product Identity & Purpose

**Saheli** ("Friend" in Hindi) is a smart AI companion app designed for household management, personal health, family coordination, and lifestyle automation. It empowers users—particularly household CEOs and individuals—to streamline everyday living through localized AI tools.

### Core Value Pillars
1. **Multilingual & Localized**: Complete support for English, Hindi, Bengali, Tamil, Spanish, and Arabic with instantaneous language switching and standard left-aligned navigation.
2. **Family Collaboration**: Role-based household sharing with granular module access permissions for family members, kids, and staff.
3. **Smart Household Management**: Medicine reminders, bill scanning, expense tracking, document vault, and emergency safety SOS.
4. **Delightful Aesthetics**: Curated color palettes (Terracotta, Ocean, Midnight dark mode), custom typography, micro-animations, and scroll-driven sticky headers.

---

## 2. Work Status & Roadmap

| Feature Area | Status | Key Components / Files |
| :--- | :---: | :--- |
| **App Scaffold & Native Linking** | ✅ Done | `App.tsx`, `index.js`, iOS CocoaPods, Android Gradle |
| **Localization & i18n** | ✅ Done | `src/i18n/index.ts`, `src/i18n/locales/*.json` (6 Languages) |
| **Navigation Shell & Stack** | ✅ Done | `src/app/_layout.tsx` (React Navigation Stack with LTR layout) |
| **Onboarding Flow** | ✅ Done | Language picker, Phone entry, Auto-advancing OTP, Profile setup |
| **Home Dashboard UI** | ✅ Done | `src/app/dashboard.tsx` with scroll-driven sticky AppBar & status pills |
| **Profile & Settings Management** | ✅ Done | `src/app/onboarding/profile.tsx` (Camera/Gallery crop options, name, phone, language picker, sign-out, account deletion) |
| **Family & Sharing Module** | 🚧 In Progress | `src/features/family/FamilyScreen.tsx` (Group members list, role badges, permission toggles, invite modal) |
| **Medicine Chest & Reminders** | ⏳ Pending | Scheduled for Next Sprint |
| **Document Vault & OCR** | ⏳ Pending | Scheduled for Sprint 3 |
| **Household Expense Tracker & UPI** | ⏳ Pending | Scheduled for Sprint 3 |
| **Safety SOS & Emergency Alerts** | ⏳ Pending | Scheduled for Sprint 4 |

---

## 3. Directory Structure

```
SaheliCLI/
├── App.tsx                    # Root entrypoint wrapped with GestureHandlerRootView
├── agent.md                   # Agent progress tracker & sprint tasks
├── README.md                  # User-facing documentation & project story
├── AI_CONTEXT.md              # THIS FILE - Master context guide for AI models
├── package.json               # Dependencies (React Native 0.86, React 19, React Navigation v7)
└── src/
    ├── app/                   # App routes & layouts
    │   ├── _layout.tsx        # Navigation Stack container & screen definitions
    │   ├── dashboard.tsx      # Main Home Dashboard with scroll transformation header
    │   └── onboarding/        # Setup flow screens
    │       ├── language.tsx   # Language selection screen
    │       ├── phone.tsx      # Phone entry screen (hint placeholder)
    │       ├── otp.tsx        # Auto-focusing OTP 6-box input screen
    │       └── profile.tsx    # Profile setup & edit screen with Camera/Gallery picker
    ├── components/            # Reusable UI elements (Button, Card, SectionHeader)
    ├── features/              # Domain-specific modules
    │   ├── auth/              # Auth state & session logic
    │   └── family/            # Family group management & permissions (`FamilyScreen.tsx`)
    ├── hooks/                 # Custom React hooks (`useTheme.ts`, `useAuth.ts`)
    ├── i18n/                  # Localization engine (`index.ts` & `locales/*.json`)
    ├── theme.ts               # Theme system: Terracotta, Ocean, Midnight palettes & typography
    └── utils/                 # Utility functions & AsyncStorage helpers (`storage.ts`)
```

---

## 4. Key Architectural Patterns & Guidelines for AI Agents

When modifying or extending this codebase, all AI models MUST follow these established patterns:

### A. Navigation & Back Button Positioning
- **Navigation Container**: Defined in `src/app/_layout.tsx`.
- **LTR Rule**: `I18nManager.allowRTL(false)` and `I18nManager.forceRTL(false)` are strictly enforced in `src/i18n/index.ts` so back buttons stay left-aligned (`top-left`) across all languages.
- **Screen Transitions**: Native stack uses standard push transitions (`slide_from_right`).

### B. Dashboard Header Transformation
- `src/app/dashboard.tsx` uses `Animated.ScrollView` with an interpolated `scrollY` value.
- When scrolled at `y = 0`, the full hero card ("due and pending") is visible.
- As `scrollY` increases, the hero card scales and fades out while a sticky AppBar (`top: 0`) fades in with compact status pills (`2 Pending • 4 Due`) and a top-right profile button.

### C. Onboarding vs Edit Profile Modes
- **Phone Entry** (`src/app/onboarding/phone.tsx`):
  - Prefills the default country code based on the user's selected onboarding language (`en`/`hi`/`bn`/`ta` -> `+91 `, `es` -> `+34 `, `ar` -> `+966 `), while allowing user to edit or rewrite it freely.
  - Stores the entered mobile number in `AsyncStorage` (`saheli.user_phone`).
- **Profile Onboarding Setup** (`src/app/onboarding/profile.tsx` with `isEditing = false`):
  - `phone` input is automatically **prefilled** with the mobile number from the phone setup step.
  - `name` input starts empty, showing a clear hint placeholder (`e.g. Priya Sharma`).
  - Language selection grid is **hidden** during onboarding (since language was selected in step 1).
  - Sign Out and Delete Account buttons are **hidden**.
  - Main button reads `Finish setup →`.
- **In-App Profile Edit** (`src/app/onboarding/profile.tsx` with `isEditing = true`):
  - Prefills saved profile data from `AsyncStorage`.
  - Displays the Language selection grid for live language switching.
  - Displays `Sign Out` (resets stack to `Language`) and `Delete Account` (clears storage & resets stack) buttons with confirmation alerts.

### D. Real Device Camera & Gallery Photo Picker
- `src/app/onboarding/profile.tsx` integrates native `react-native-image-picker` helpers:
  - `launchCamera({ mediaType: 'photo', cameraType: 'front', quality: 0.8 })` for real camera photo capture.
  - `launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 })` for real device gallery photo selection.
  - Displays `<Image source={{ uri: photoUri }} />` when a photo is selected.


### D. OTP Input UX Rules
- `src/app/onboarding/otp.tsx` uses a 6-box input array with `inputRefs`.
- Entering a digit automatically focuses the next input (`inputRefs.current[index + 1]?.focus()`).
- Pressing `Backspace` on an empty box automatically focuses the previous input.
- Pasting a full 6-digit code populates all 6 boxes at once.

---

## 5. Primary Data Models

### Family Member Schema (`src/features/family/FamilyScreen.tsx`)
```typescript
export interface FamilyMember {
  id: string;
  name: string;
  phone: string;
  relation: string; // 'Self' | 'Spouse' | 'Parent' | 'Child' | 'Staff'
  role: 'owner' | 'editor' | 'viewer';
  avatar: string;
  permissions: {
    medicines: boolean;
    expenses: boolean;
    documents: boolean;
    safety: boolean;
  };
}
```

### Profile Storage Schema (`saheli.user_profile`)
```typescript
export interface UserProfile {
  name: string;
  phone: string;
  role: 'household_ceo' | 'individual';
  location: string;
  avatar: string;
}
```

---

## 6. How AI Models Should Execute Tasks

1. **Check Type Validity**: Always verify TypeScript types with `npx tsc --noEmit`.
2. **Preserve Navigation Direction**: Keep headers and back buttons left-aligned (`←` top-left).
3. **Maintain Localization**: Add new UI strings to `src/i18n/locales/en.json` (and corresponding locale files).
4. **Update Documentation**: Update `README.md`, `agent.md`, and this `AI_CONTEXT.md` file whenever milestones advance or architectural decisions change.

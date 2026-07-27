# SaheliCLI

**Saheli** is a comprehensive AI-powered life assistant designed for Indian women and their families — a single app that consolidates finance, health, home, safety, style, and payments into one intuitive experience.

> This README currently documents the first three core story areas: Authentication & Session, Home Dashboard, and Family Groups & Sharing.

## 🔐 Authentication & Session

- Phone OTP login — any Indian phone number; demo OTP `123456`
- Forced OTP verification — no bypass; user must enter the code
- 15-minute idle auto-logout — session expires if the app is unused
- 24-hour absolute session lifetime — hard cap regardless of activity
- Re-auth UX — phone number pre-filled, amber "Session expired" banner
- Manual sign-out available from Profile screen
- 6-language onboarding — English, Hindi, Bengali, Tamil, Spanish, Arabic
- Account deletion with DELETE confirmation phrase

## 🏠 Home Dashboard

- Glossy hero card — personalized greeting + due/pending badges
- Today's snapshot — 30-day spend + 7-day medicine adherence
- Quick actions strip — Scan bill, Pay UPI, Take medicine, Add expense, Add fuel, Go Premium
- 3-column tile grid — Scan, UPI Pay, Family, Money, Documents, Safety, Wellness, Style, Events
- In-context tooltips (❓) on section headers
- Profile completion path to the dashboard

## 🧑‍🤝‍🧑 Family Groups & Sharing

- Invite family members by phone number
- Fine-grained module permissions per member:
  - Documents (view / edit)
  - Vehicles (view / edit)
  - Medicine Chest (view / edit)
  - Expense Groups (view / edit)
  - Resources (view / edit)
  - Events (view / edit)
- Role-based access — Viewer / Editor
- Accept / decline invitations
- Leave family anytime
- Owner-only delete guardrails for critical actions
- Strict multi-tenant isolation — no accidental data leaks

## Current project scope

The app is being built in phases. Right now the focus is on:

1. Authentication & onboarding flow
2. Home dashboard experience
3. Family sharing and group permissions

Other app domains will be added later: documents, medicine, expenses, UPI payments, vehicles, wellness, style, events, and AI integrations.

## Design principles

- Keep a central theme system with colors, font styles, spacing, and reusable tokens.
- Store theme definitions in `src/theme` and use them throughout the UI.
- Build reusable components in `src/components` for buttons, cards, forms, and layout containers.
- Organize feature screens in `src/screens` or `src/app`, and keep navigation logic separate.
- Prefer composition over duplication so color, typography, and spacing are consistent across the app.
- Use a clean file structure: `src/theme`, `src/components`, `src/screens`, `src/features`, `src/hooks`, `src/utils`.

## Recommended source structure

```
src/
  app/                 # app-specific screens, navigation, onboarding
    _layout.tsx
    onboarding/
      language.tsx
      phone.tsx
      otp.tsx
      profile.tsx
  components/          # reusable UI components and design system atoms
    Button.tsx
    Card.tsx
    Header.tsx
    IconButton.tsx
  features/            # feature modules, each with its own domain logic
    auth/
      auth.ts
      auth.types.ts
    family/
      family.ts
      permissions.ts
  hooks/               # shared React hooks
    useAuth.ts
    useTheme.ts
    useSession.ts
  i18n/                # localization resources and helpers
    index.ts
    locales/
      en.json
      hi.json
      bn.json
      ta.json
      es.json
      ar.json
  styles/              # shared styles and screen-specific style sheets
    onboarding.ts
  theme/               # theme tokens, palettes, and font definitions
    index.ts
    colors.ts
    typography.ts
  utils/               # helpers, formatters, and generic utility functions
    storage.ts
    validators.ts
```

## Getting started

### Install dependencies

```sh
npm install
```

### Run Metro

```sh
npm start
```

### Run iOS

```sh
npm run ios
```

### Run Android

```sh
npm run android
```

## Project status

- ✅ Authentication & onboarding scaffolded
- ✅ Language support and i18n setup
- ✅ Native module linking and CocoaPods installation
- ✅ TypeScript validation passing
- ⚠️ Home dashboard UI and feature polish in progress
- ⚠️ Family sharing permission model still under development
- ⏳ Other major app modules pending
## Project status board

| Area | Status | Notes |
| --- | --- | --- |
| Authentication & Session | ✅ Completed | OTP auto-advance 6-box login, session storage |
| Home Dashboard | ✅ Completed | Scroll-transforming sticky header & compact due/pending status |
| Profile & Settings | ✅ Completed | Camera/Gallery crop options, name, phone, language picker, sign-out & account deletion |
| Family Groups & Sharing | ✅ Completed | Group members overview, roles, permission toggles, invite modal |
| AI Agent Master Context | ✅ Created | `AI_CONTEXT.md` single-source guide for AI models |
| Medicine & Health | ⏳ Pending | Next Sprint |
| Document Hub | ⏳ Pending | Sprint 3 |
| Money & Payments | ⏳ Pending | Sprint 3 |


## Next sprint

- Finish the phone OTP login flow and session expiration behavior
- Add the onboarding language selection screen and persistence
- Build the Home dashboard hero card and quick-action strip
- Create the first Family invite flow and a basic Viewer/Editor model
- Keep the app launch flow stable on iOS with Metro

## How to contribute

1. Read the current app story in `README.md`.
2. Review feature status in `agent.md`.
3. Update the relevant section with progress, new tasks, or blocking issues.
4. Keep the story summary aligned with the actual code and UI.
## Notes

Use `README.md` as the primary app story summary. Keep this file updated when new sections are added or behavior changes.

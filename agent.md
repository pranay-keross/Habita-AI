# Saheli Agent Workflow

This file defines the AI agent workflow and project status tracking for the SaheliCLI app.

## Purpose

The AI agent is responsible for:

- maintaining a clear architecture for the app and codebase
- tracking completed work, in-progress work, and pending milestones
- preserving the Saheli story across prompts without requiring the user to re-explain the project constantly
- creating and updating project documentation with the current app scope and status

## Current focus areas

1. Authentication & Session
2. Home Dashboard
3. Family Groups & Sharing

## Work status

### Done

- App scaffold created with React Native CLI
- Root app entrypoint and navigation shell established
- i18n and localization support added for 6 languages
- `react-native-gesture-handler`, `react-native-screens`, and `react-native-safe-area-context` linked
- iOS CocoaPods integration completed
- TypeScript validation passes (`npx tsc --noEmit`)
- Fixed navigation layout direction and standardized top-left back button positioning across screens
- Implemented Home Dashboard scroll-driven header transformation (hero card collapses into sticky AppBar with due & pending status)
- Overhauled OTP screen to auto-advance to next box on digit entry, support backspace focusing, and 6-digit code pasting
- Added language-mapped country code prefill (`+91 `, `+34 `, `+966 `) on Mobile Number screen while allowing custom edits
- Configured mobile number prefill on Profile onboarding screen from phone step while keeping name as hint placeholder
- Integrated real device Camera (`launchCamera`) & Gallery (`launchImageLibrary`) photo selection via `react-native-image-picker` with photo rendering
- Configured Language Selection visibility (hidden during onboarding profile setup, visible when editing profile inside the app)
- Built Family Groups & Sharing module (`src/features/family/FamilyScreen.tsx`) with role badges (Owner/Editor/Viewer), permission toggles, and invite modal
- Maintained single-source `AI_CONTEXT.md` master documentation for AI model workflows




### Pending

- Medicine & Health modules
- Document Hub and OCR workflows
- Expense tracking and UPI payments
- Vehicle manager and staff management
- Wellness, style, events, and safety modules
- AI integration with Gemini / GPT-4o-mini for OCR and parsing
- Real external integrations for SMS, payment, and voice

## Agent architecture

### Primary responsibilities

- Track active story / scope in this file and `README.md`
- Keep task state separated from code implementation
- Use clear labels for what is complete, in-progress, and not started
- Avoid asking the user to repeat the app story when context is full
- Maintain the app-wide theme system and reusable component architecture
- Ensure the file structure supports consistent UI, feature isolation, and long-term maintainability

### How the agent should work

1. Read current project files and existing docs first.
2. Update `README.md` with app story and current scope.
3. Update `agent.md` with milestones and progress status.
4. Preserve the core story in docs; add new sections instead of rewriting the whole story every time.
5. Use concise, explicit status markers for each major feature area.

## Recommended file structure

The agent should encourage a stable `src/` organization with:

- `src/app` for app-level navigation and onboarding flow
- `src/components` for reusable UI building blocks
- `src/features` for domain-specific modules
- `src/theme` for palette and typography tokens
- `src/hooks` for shared custom hooks
- `src/i18n` for localization
- `src/styles` for shared style sheets
- `src/utils` for generic utilities

## Milestones

### Milestone 1: Core launch

- [x] App bootstrap and native project setup
- [x] Navigation container and onboarding flow
- [x] i18n setup for six languages
- [ ] Stable login + session lifecycle
- [ ] Reliable app startup on iOS/Android with Metro

### Milestone 2: Dashboard & family

- [ ] Home dashboard UX with actions and cards
- [ ] Family groups model and invitation flow
- [ ] Permission controls and role-based access
- [ ] Profile and sign-out flow

### Milestone 3: Expand modules

- [ ] Medicine chest and reminders
- [ ] Document hub with OCR and tags
- [ ] Household expense tracking
- [ ] UPI payments and QR scanning
- [ ] Vehicle and staff management
- [ ] Safety SOS and location features

## Next sprint

- Complete phone OTP login and session expiry behavior
- Build onboarding language selection + persistence
- Implement the Home dashboard hero card and quick action strip
- Create Family invite flow and basic role-based permissions
- Stabilize iOS app startup with Metro connectivity

## How to contribute

- Read `README.md` first for the app story and current scope.
- Update `agent.md` when a milestone advances or a new work area is added.
- Keep new work aligned with the three active focus areas: Authentication, Home Dashboard, and Family Sharing.
- Use `README.md` for product story and `agent.md` for progress tracking.

## Usage notes

- Keep this file as the agent’s internal task tracker.
- Update the status sections when work completes or changes.
- Add new feature areas under `Pending` instead of expanding the scope without confirmation.

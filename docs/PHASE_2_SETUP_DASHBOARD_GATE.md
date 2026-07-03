# Phase 2: Setup Completion + Dashboard Gate

## Scope Implemented

This phase adds setup completion logic, dashboard gating, and plan-based access controls for Clutch Connect.

## Completion Helper

- Added `isConnectSetupComplete(...)` in `lib/connect.ts`.
- Completion now requires:
  - A valid public slug.
  - A usable public identity (business/contact/title fallback chain).
  - A valid sanitized builder config.
  - At least one visible contact method or visible link.
- Helper supports optional link rows from `profile_links` for compatibility with legacy profiles.

## Beginner Setup Field Expansion

### Step 1 (Basic)

Added beginner-first identity fields:
- First name
- Last name
- Display name
- Organization
- Role
- Avatar image URL
- Custom slug

Mapping behavior preserves compatibility:
- Organization -> `profiles.business_name`
- Display name (or first+last fallback) -> `profiles.contact_name`
- Role -> `profiles.title`
- Avatar URL -> `profiles.avatar_url`

### Step 2 (Contact)

Added `Service area or location` to support beginner location input.

Mapping behavior:
- Service area is persisted into builder `directions-button` block data (`address` + maps URL).

## Setup Completion Behavior

- Final guided setup action now completes setup and redirects to `/portal?setup=complete`.
- Setup API (`POST /api/connect/setup`) now calculates completion using shared helper.
- When setup is complete, customer onboarding state is updated to `active`.

## Dashboard Gate

- Main dashboard route (`/portal`) now checks setup completion for non-admin users.
- Incomplete non-admin users are redirected to `/portal/connect/setup`.
- Admin users are exempt from setup gating.

## Connect Hub CTA Behavior

- `/portal/connect` now adjusts actions based on:
  - setup completion state
  - advanced builder lock state
- Incomplete setup users get a clear “Continue Guided Setup” callout.
- Plan-locked users see an explicit advanced builder lock message.

## Advanced Builder Gate By Plan

- Added plan helpers in `lib/plans.ts`:
  - `isAdvancedBuilderUnlocked(...)`
  - `getAdvancedBuilderLockMessage(...)`
- Advanced builder is now gated on both plan and subscription lock state.
- `/portal/connect/build` enforces gate server-side and redirects locked users to `/portal/connect?builder=locked`.
- Guided setup header and connect dashboard CTAs now respect this gate.

## Free Plan Dashboard Language

- Portal dashboard now uses free-plan aware Connect copy and CTA targets:
  - Free plan users are guided to `/portal/connect/setup`.
  - Paid/unlocked users continue to `/portal/connect/build`.

## Validation and QA

### Build/Test Commands Run

- `npm run lint` (passes with pre-existing warnings; no new blocking lint errors introduced by this phase)
- `npx tsc --noEmit` (passes)
- `npm run build` (passes)

### Notes

- `npm run tsc -- --noEmit` failed because there is no `tsc` script in `package.json`; direct `npx tsc --noEmit` was used instead.
- Existing lint warning set remains in unrelated areas and was not expanded into this phase's changes.

## Phase 2B Authenticated Browser QA (2026-07-01)

### Runtime Scenarios Executed

- Admin user flow:
  - `/portal` is accessible and not setup-gated.
  - `/portal/connect/build` remains accessible.
- Simulated incomplete non-admin flow:
  - `/portal` redirects to `/portal/connect/setup`.
- Simulated completed non-admin paid flow:
  - `/portal` remains on dashboard.
  - `/portal/connect/build` is accessible.
- Simulated completed non-admin free flow:
  - `/portal/connect` shows locked builder messaging and locked CTA.
  - `/portal/connect/build` redirects to `/portal/connect?builder=locked`.

### Setup Completion Submit Checks

- Final setup submit redirects to `/portal?setup=complete`.
- Setup completion banner renders on dashboard.
- Onboarding activation verified:
  - customer was set to `onboarding_status='not_started'` before submit,
  - after submit, status became `active`.

### Public Profile Checks

- `/u/my-test` renders business and headline content correctly.
- Hidden social links do not render in the public profile.
- Service area mapping works:
  - setting `Service area or location` to `Nashville, TN` in setup produced a public Directions entry and maps URL.

### Mobile and Console QA

- Viewports tested: 390, 430, 768, desktop.
- Routes tested for overflow and runtime errors:
  - `/portal`
  - `/portal/connect`
  - `/portal/connect/setup`
  - `/portal/connect/build`
  - `/u/my-test`
- Result:
  - no horizontal overflow detected,
  - no route-blocking console errors,
  - only non-blocking Next preload warnings observed.

### Bugs Found and Fixed

- Fixed runtime React warning on setup page:
  - issue: controlled input became uncontrolled when recovering older local draft payloads after new Phase 2 fields were introduced,
  - fix: added `normalizeRecoveredDraft(...)` in `components/connect/ConnectSetupWizard.tsx` to safely coerce and merge recovered local draft state with current schema defaults.

### Post-Fix Validation

- `npm run lint`: unchanged pre-existing warnings only.
- `npx tsc --noEmit`: pass.
- `npm run build`: pass.

## Phase 2C Focused Setup Wizard QA/Fix Pass (2026-07-01)

### Scope

- Audited the Clutch Connect beginner setup wizard only, plus direct setup/public-profile surfaces:
  - `/portal/connect/setup`
  - `/portal`
  - `/portal/connect`
  - `/portal/connect/build`
  - `/u/my-test`
- No Shopify, QR creation, analytics, wallet, webhook, or plan/tier architecture changes were made.

### Buttons and Controls Tested

- Step tabs: Basic Info, Contact Info, Links, Advanced.
- Continue and Back navigation.
- Final setup save path was covered by existing Phase 2B completion QA and build/API validation in this pass.
- Contact visibility toggles for phone, email, and website.
- Link controls: Add another link, quick-add tiles, Want to add more expand/collapse, type selector, visible/hidden toggle, remove link.
- Header CTAs and route CTAs on setup, connect hub, dashboard, advanced builder, and public profile routes.

### Fields Tested

- Basic fields: first name, last name, display name, organization, role, avatar URL, slug.
- Contact fields: phone, email, website, bio, service area/location.
- Link fields: type selector, label, URL/handle for Website and unsafe URL cases.
- Advanced fields were source-audited and build/type validated: accent color, button color, text color, theme mode, profile style, layout.

### Bugs Found and Fixed

- Hidden blocks were still rendered outside editor mode with a faded style.
  - Fix: `BuilderPublicProfile` now omits hidden blocks/sections in preview and public modes while preserving editor visibility.
- Public profiles could render an empty section label, such as `More`, when a visible social block had no renderable links.
  - Fix: public/preview section rendering now checks whether contained blocks can actually render content before displaying the section shell.
- Unsafe avatar URLs were blocked on save but could still be attempted by the live preview, causing React's `javascript:` URL security warning.
  - Fix: setup preview config and shared avatar renderer now accept only valid `http`/`https` image URLs.
- Unsafe website draft input could appear in preview before save validation.
  - Fix: setup preview normalizes website draft values through the beginner link URL normalizer before rendering.
- Setup API trusted avatar URLs and did not enforce the beginner link cap server-side.
  - Fix: API now validates avatar and website URLs as `http`/`https` only and rejects payloads over the 6-link beginner limit.
- Field errors stayed visible after a user edited the field again.
  - Fix: setup draft/link updates now clear stale field errors as the user continues editing.
- Beginner link normalization accepted weak email/phone values and some unsafe full social URLs too loosely.
  - Fix: shared link normalization now fails closed for unsafe schemes, malformed emails, and phone values with too few digits.

### Preview Behavior Verified

- New/empty link preview shows `Your links will appear here` in the setup preview only.
- Basic field edits update the live preview and slug preview immediately.
- Slug preview uses `clutchconnect.link/{slug}` and normalizes spaces/special characters.
- Phone visibility toggle hides and restores the preview Call button.
- Unsafe avatar, website, and link values do not render as active preview URLs.
- A newly added Website link normalizes `example.com/setup-preview-link` to `https://example.com/setup-preview-link` in preview.
- Hidden and removed links disappear from preview.

### Public Profile Results

- `/u/my-test` renders only saved profile data.
- Setup placeholder strings were not present on public profile output:
  - `Your Name`
  - `Your Business`
  - `Your role or headline`
  - `Your links will appear here`
- Empty optional public social sections now hide cleanly.
- Temporary QA link data was removed through the setup UI and verified absent from `/u/my-test`.

### Mobile and Runtime QA

- Viewports tested on `/portal/connect/setup`: 390px, 430px, 768px, and desktop.
- Result: no document-level horizontal overflow at tested widths.
- Console/runtime route sweep passed with no setup-blocking errors on:
  - `/portal`
  - `/portal/connect`
  - `/portal/connect/setup`
  - `/portal/connect/build`
  - `/u/my-test`

### Validation

- `npm run lint`: completed with existing warnings only; no blocking lint errors.
- `npx tsc --noEmit`: pass.
- `npm run build`: pass.
- No Playwright test file was added because the repo does not currently include Playwright/Jest/Vitest test support or scripts.

### Remaining Risks

- Full multi-account duplicate-slug race testing remains manual/back-end dependent.
- Free/basic versus paid builder gate was previously covered in Phase 2B; this pass route-smoked the build page in the authenticated session but did not change plan logic.
- Existing lint warnings remain outside this setup-focused scope.

### Release Readiness

- No known setup-wizard release-blocking bugs remain from this focused pass.

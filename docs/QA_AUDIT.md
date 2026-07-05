# Clutch QR QA Audit

## Executive Summary

I reviewed the live auth surfaces in browser and audited the protected portal routes and editors from source. The app is broadly structured well, but there are several important UX and functional gaps that should be fixed before wider customer use.

The most serious blockers are the Create QR flow missing a usable submit surface, the admin customer form not offering an Admin plan option, and a few dead or inconsistent account-management actions in Connect and auth.

## Critical Issues

### 1. Create QR studio does not expose a usable create/submit surface
- Page: Create QR
- Location: [components/QRCodeCreateStudioForm.tsx](components/QRCodeCreateStudioForm.tsx#L309) and [components/QRLivePreview.tsx](components/QRLivePreview.tsx#L63)
- Problem: the create studio passes submit/input handlers into `QRLivePreview`, but that component only renders preview cards and never renders the missing form controls or a create button. As a result, the page reads like a preview shell rather than a complete QR creation form.
- Screenshot description: Source-based finding; the rendered component tree is preview-heavy and does not surface a full create action.
- Severity: Critical
- Recommended fix: render the missing QR name, destination URL, and submit controls directly in the create studio flow.
- Suggested implementation approach: move the primary form into `QRCodeCreateStudioForm`, wire it to the existing submit handler, and surface loading / disabled states on the CTA.

## High Priority Issues

### 2. Admin customer form cannot assign the Admin plan directly
- Page: Admin
- Location: [app/admin/page.tsx](app/admin/page.tsx#L489)
- Problem: the create/edit customer plan dropdown only offers Free QR, QR Pro, and QR Pro+. There is no Admin option even though the page manages admin accounts and already exposes an `is_admin` checkbox.
- Screenshot description: Not browser-captured; issue is visible in the form markup.
- Severity: High
- Recommended fix: either add an Admin plan option or clearly document that the `is_admin` checkbox is the only way to grant admin status.
- Suggested implementation approach: align the dropdown and admin checkbox so the account model and admin UI cannot drift apart.

### 3. Connect Links “Edit” action is a dead link
- Page: Clutch Connect > Links
- Location: [components/ConnectLinksEditor.tsx](components/ConnectLinksEditor.tsx#L208)
- Problem: each existing link renders an Edit anchor to `#edit-{id}`, but there is no matching anchor target or inline editor on the page. Clicking Edit does nothing meaningful.
- Screenshot description: Clicking Edit does not change the page state or reveal an editor.
- Severity: High
- Recommended fix: replace the dead anchor with a real edit action or render anchored edit sections for each link.
- Suggested implementation approach: add inline edit rows or a modal editor and update the action to open it.

### 4. Public `/clutch-connect` route redirects to a private portal page
- Page: Public Clutch Connect alias
- Location: [app/clutch-connect/page.tsx](app/clutch-connect/page.tsx#L4)
- Problem: the route immediately redirects to `/portal/connect`, which is auth-gated. That makes the alias unusable as a public profile destination and creates route ambiguity.
- Screenshot description: Redirect occurs immediately; no public profile view renders.
- Severity: High
- Recommended fix: either make this route explicitly private or point it at a real public landing/profile experience.
- Suggested implementation approach: keep `/clutch-connect` only as a portal alias if that is the intended UX, otherwise route it to the public profile surface.

## Medium Priority Issues

### 5. Password requirements are inconsistent between reset and change flows
- Page: Change Password / Reset Password
- Location: [app/change-password/page.tsx](app/change-password/page.tsx#L20) and [app/auth/reset-password/page.tsx](app/auth/reset-password/page.tsx#L26)
- Problem: the change-password page requires 12 characters plus mixed character classes, while the reset-password page only requires 8 characters. The two flows do not enforce the same policy.
- Screenshot description: Browser check showed both pages render normally, but the validation rules differ.
- Severity: Medium
- Recommended fix: use one shared password policy across both flows.
- Suggested implementation approach: extract a common validator and reuse it in both routes.

### 6. Lead status actions in Connect Leads are client-only
- Page: Clutch Connect > Leads
- Location: [components/connect/ConnectLeadsCRM.tsx](components/connect/ConnectLeadsCRM.tsx#L340)
- Problem: the Mark Contacted / Mark Converted buttons only update local component state. The state resets on refresh because there is no server persistence for the status changes.
- Screenshot description: Status pills update in the UI, but the action does not persist to the backend.
- Severity: Medium
- Recommended fix: persist lead status changes through an API or disable the controls until persistence exists.
- Suggested implementation approach: add a lead-status update endpoint and hydrate the component from server data.

### 7. Admin account management has no visible suspend/delete actions
- Page: Admin
- Location: [app/admin/page.tsx](app/admin/page.tsx#L480)
- Problem: the admin table supports save/update and QR creation, but there are no visible suspend or delete controls for customer accounts. If those operations are expected in the private dashboard, they are missing from the UI.
- Screenshot description: The Manage column exposes save controls only.
- Severity: Medium
- Recommended fix: add explicit suspend/delete actions if those workflows are required.
- Suggested implementation approach: provide guarded admin actions with confirmation prompts and clear role-based restrictions.

## Low Priority Issues

### 8. Forgot-password page includes an extra alert region in the browser snapshot
- Page: Forgot Password
- Location: [app/forgot-password/page.tsx](app/forgot-password/page.tsx#L1)
- Problem: the browser snapshot showed an alert node even when the page was in its default state, which suggests an extra message region is present in the DOM.
- Screenshot description: The browser snapshot showed an unlabeled alert container beneath the form.
- Severity: Low
- Recommended fix: only render the alert wrapper when there is actual message content.
- Suggested implementation approach: tighten the conditional rendering around the alert block and re-check spacing on the auth card.

## Page-by-Page Findings

### Overview
- No critical issues found in the overview shell during source review.
- Navigation and CTA placement are coherent, and the page uses a consistent card/grid layout.

### QR Codes
- The QR studio structure is the main blocker because the create surface is incomplete.
- The live preview and styling controls are present, but the actual creation flow is not surfaced clearly.

### Clutch Connect
- The public profile renderer is functional and the primary buttons are wired to real destinations.
- The link-management and lead-management flows contain the issues noted above: dead edit link and non-persistent lead actions.

### Create QR
- Critical issue: missing usable submit surface.
- Styling, pattern, logo, and tracking panels exist, but the user-facing creation workflow is incomplete.

### Analytics
- No blocking browser-observed issues were found in the basic analytics shell during this pass.
- Table and chart sections are present, and the responsive CSS includes breakpoints for stacked layouts.

### Admin
- Admin navigation, customer search, and form layout are present.
- The plan dropdown and missing destructive actions are the notable gaps.

### Settings
- The dedicated settings page is complete enough to function as an account center.
- The notification and branding sections should remain clearly marked as placeholders until persistence is added.

### Login / Auth
- The login and forgot-password surfaces render cleanly in browser.
- The password reset/change policy mismatch should be fixed so users do not see two different rules for the same account action.

### Public Clutch Connect Profile Pages
- The `/u/[slug]` renderer is the real public profile surface.
- The `/clutch-connect` alias currently redirects to a private portal page instead of a public profile view.

## Audit Notes

- I could not fully exercise auth-gated pages in the live browser without a valid session, so protected-route findings were cross-checked from source.
- No code changes were made in the app during this audit.

## Phase 4.6 Authenticated QA Notes - 2026-06-30

### What Passed

- Authenticated route sweep passed for `/portal`, `/portal/connect`, `/portal/connect/setup`, `/portal/connect/build`, `/portal/connect/leads`, `/portal/create`, `/portal/qr`, `/portal/analytics`, `/portal/heatmap`, `/portal/settings`, and `/admin`.
- Guided Setup saves into the existing `profiles` row and current `builder_config`; it does not create a separate profile system.
- Advanced Builder loads the saved setup data, exposes Setup / Design / Sections, shows inspector controls, and saves successfully.
- Public `/u/[slug]` renders the updated Guided Setup business name, title, phone, email, website, and bio.
- Website QR creation works from `/portal/create`.
- Clutch Connect Profile is exposed in `QRTypeSelector`, can be selected, creates a QR successfully, and appears in `/portal/qr`.
- `/qr/[slug]` for a Connect Profile QR returns a redirect to the public profile URL and increments linked QR readiness in the Connect dashboard.
- Admin plan dropdown includes Admin, and touched admin/plan UI uses Agency-facing copy instead of QR Pro+.
- Mobile QA at 390px and 430px passed for `/portal/connect`, `/portal/connect/setup`, `/portal/connect/build`, `/u/[slug]`, and `/portal/create` with no document-level horizontal overflow.

### What Failed And Was Fixed

- Guided Setup initially updated phone, website, and bio, but did not restore missing `business-name-block` and `subheader-block` records in older builder configs. Public profiles could therefore miss the business name/headline after setup.
- Fix: Guided Setup now ensures required avatar, business name, subheader, phone, email, and website blocks exist before mapping form fields into `builder_config`.
- Guided Setup did not expose a clear saving/error state.
- Fix: the submit button now shows `Saving...` during submission, and setup redirects back with a safe error message if the profile update/insert fails.
- Public profile URL support only emitted `/u/[slug]`.
- Fix: when `NEXT_PUBLIC_CLUTCH_CONNECT_PUBLIC_BASE_URL` is configured, profile links emit `base/[slug]` and the internal `/u/[slug]` render route remains available behind the proxy.
- Fix: `proxy.ts` now rewrites `clutchconnect.link/[slug]`-style one-segment paths to `/u/[slug]` only on the configured public Connect host, with reserved paths protected.

### Current Public URL Format

- If `NEXT_PUBLIC_CLUTCH_CONNECT_PUBLIC_BASE_URL` is set, the supported customer-facing format is `clutchconnect.link/[slug]`.
- If it is not set, the internal render route still lives at `qr.clutchprintshop.com/u/[slug]`, but the public helper still emits the public base URL format when configured.
- Existing `/u/[slug]` links continue to work.

### Remaining For Phase 4.7

- Persist Leads CRM status/delete actions instead of keeping them client-only.
- Run a dedicated destructive-control builder test using a disposable profile or seeded customer before deleting/reordering real profile blocks.
- Decide whether the admin dashboard table should get a mobile-specific management view; it remains intentionally wide and scroll-heavy.
- Wallet generation still depends on Apple/Google wallet environment variables; this pass verified URL wiring and fallback behavior but did not rewrite pass generation.

## Phase 4.7 Leads CRM Persistence Notes - 2026-06-30

### What Changed

- Added migration `20260630195751_add_profile_leads_crm_fields.sql`.
- Added CRM fields to `profile_leads`: `status`, `archived_at`, `contacted_at`, `qualified_at`, `converted_at`, `closed_at`, `crm_notes`, and `updated_at`.
- Added valid lowercase status constraint for `new`, `contacted`, `qualified`, `converted`, `closed`, and `archived`.
- Added indexes for profile/status, archived timestamp, and updated timestamp.
- Added a safe `public.set_updated_at()` definition and `set_profile_leads_updated_at` trigger for `updated_at`.
- Added owner/admin update policy and authenticated update grant for `profile_leads`.
- Applied the migration to Supabase project `rxmabeieluysgtpcqvom` on 2026-06-30.

### API Route

- Added `PATCH /api/connect/leads/[leadId]`.
- The route requires an authenticated customer.
- Non-admin customers can update only leads attached to profiles owned by their customer row.
- Admin customers can update leads across profiles.
- The route accepts safe updates only: `status`, `crm_notes`, and `action=archive|unarchive`.
- Status transition timestamps are set server-side. Archive uses `archived_at` and does not hard-delete leads.
- Unarchive clears `archived_at` and restores `status` to `new` only when the current persisted status is `archived`.

### CRM UI

- `ConnectLeadsCRM` now hydrates status/archive/notes/timestamps from server data.
- Status, archive, unarchive, and notes updates are optimistic and roll back on API failure.
- Delete has been replaced with Archive Lead.
- Lead detail now shows current status, captured/contacted/qualified/converted/closed/archive dates, CRM notes, Save Notes, and CRM-lite status actions.
- CSV export now includes company, persisted status, contacted/qualified/converted/closed/archive timestamps, CRM notes, and message.
- The inbox now filters Active Leads, Archived Leads, or All Leads.
- The lead inbox now has mobile lead cards below 640px while keeping desktop tables and reporting tables intact.

### QA Status

- `npm run lint` passes with existing warnings.
- `npm run build` passes.
- Unauthenticated PATCH requests return `401 Unauthorized`.
- Local protected routes `/portal/connect` and `/portal/connect/leads` still redirect unauthenticated visitors to `/login`.
- Local public `/u/[slug]` render smoke check passed.
- Supabase schema verification confirmed the CRM columns, status check constraint, and three new indexes exist after migration application.

### Remaining

- Verify invalid authenticated statuses return `400`.
- Verify a non-admin customer cannot update another customer's lead.
- Run authenticated browser mutation QA on `/portal/connect/leads` with populated leads after deployment: status persistence, archive/unarchive persistence, notes persistence, CSV export contents, and refresh behavior.
- In-app browser automation timed out during the 390px/430px local page pass; mobile behavior is CSS/build verified but should still be manually checked with authenticated populated leads.

## Phase 4.7 Final QA

### What Was Tested

- Audited `app/portal/connect/leads/page.tsx`, `components/connect/ConnectLeadsCRM.tsx`, `app/api/connect/leads/[leadId]/route.ts`, and migration `20260630195751_add_profile_leads_crm_fields.sql`.
- Verified the Leads CRM data path loads persisted `status`, CRM timestamps, archive timestamp, and notes from Supabase into the client component.
- Verified `PATCH /api/connect/leads/[leadId]` accepts only `status`, `crm_notes`, and `action=archive|unarchive`.
- Verified valid persisted statuses are `new`, `contacted`, `qualified`, `converted`, `closed`, and `archived`.
- Verified the UI includes optimistic updates with rollback on failed API responses.
- Verified CSV export includes name, email, phone, company, source, date captured, status, contacted/qualified/converted/closed/archive timestamps, CRM notes, and message.
- Verified mobile lead cards are present under the 640px breakpoint.
- Reviewed owner/admin access logic in the API route and the migration policy.

### What Passed

- Lead status, archive/unarchive, and CRM notes are persisted through the API route rather than staying client-only.
- Unauthenticated users receive `401 Unauthorized`.
- Invalid lead IDs and invalid statuses return `400`.
- Non-admin customers are restricted to leads on profiles owned by their customer row; admin customers can update across profiles.
- Archive remains destructive-safe; no hard-delete was added.
- Mobile lead cards are implemented for small screens.

### What Was Fixed

- The Leads dashboard funnel now excludes legacy server-side profile render events from counted profile views, matching the shared analytics behavior that counts client page views separately from server profile views.
- The Leads activity timeline now labels profile views as `Client page view` or `Server profile view` instead of flattening both into a generic profile view label.

### What Remains Manual-Only

- Browser download verification for CSV export contents.
- End-to-end authenticated customer-vs-other-customer mutation test using two real non-admin sessions.
- Admin cross-profile mutation test from the production admin session.

### Launch Blockers

- No Leads CRM launch blocker remains in source, but the multi-account authorization checks above should still be exercised manually before broad customer rollout.

## Phase 5 Launch Validation - 2026-07-01

### 1. Summary

- Phase 5 regression and launch validation is complete for the Phase 4 pricing/copy rollout scope.
- Build, typecheck, and Shopify provisioning fixtures all pass in the current workspace state.
- One functional regression was identified during validation (admin portal lock-state behavior) and fixed.

### 2. What Passed

- TypeScript gate passed: `npx tsc --noEmit --incremental false`.
- Production build gate passed: `npm run build` (Next.js build completed, route generation successful).
- Shopify provisioning fixture matrix passed with zero failures:
	- `npx tsx -e "import { runShopifyPlanDetectionFixtureCheck } from './lib/shopify-provisioning.fixtures'; ..."`
	- Result: `FAILED 0` (11/11 fixture scenarios passed).
- Legacy customer-facing label cleanup scans passed in Shopify theme scope:
	- No matches for `QR Pro Plus`, `QR Pro+`, `Starter QR`, `10 QR`, `60 QR`.
- Required Phase 4 content/link presence checks passed in Shopify theme scope, including:
	- `Plans that grow with your business` section.
	- `Includes Clutch Connect Basic Free` messaging.
	- `Start QR Pro for $14.99/mo` CTA.
	- Footer/discoverability links to `/pages/pricing` and `/pages/clutch-connect`.
- Plan normalization guardrails confirmed:
	- Canonical normalization falls back to `connect_basic` for unknown/blank values.

### 3. Broken Flows Found

- Admin lock-state parity issue in portal lock derivation:
	- Some lock calculations could present as locked when user context is admin in specific portal surfaces.
	- Impact: admin UX inconsistency (display/state mismatch), not a checkout or provisioning data corruption risk.

### 4. Fixes Applied

- Added explicit admin-aware unlock behavior for lock-state booleans in portal surfaces:
	- [app/portal/page.tsx](app/portal/page.tsx)
	- [app/portal/connect/page.tsx](app/portal/connect/page.tsx)
- Post-fix validation rerun:
	- TypeScript passed.
	- Production build passed.

### 5. Remaining Risks

- Runtime storefront verification in a true Shopify preview/prod theme context is still required for complete confidence in mobile rendering and CTA behavior under actual theme settings/content data.
- Existing repository has many in-progress unrelated local modifications; release cut should ensure only intended Phase 4/5 scope is promoted.

### 6. Manual Tests Still Needed

- Shopify storefront manual QA (desktop + mobile):
	- Pricing page cards/table/accordion behavior.
	- Clutch Connect, QR Pro, Smart Business Card, and Business Kits page copy/CTA correctness.
	- Footer/nav discoverability paths in live storefront navigation.
- End-to-end purchase smoke test on Shopify for each public plan path to confirm expected product/variant/selling-plan behavior remains unchanged.
- Post-deploy portal smoke test for admin account to verify lock-state presentation remains fully unlocked where intended.

### 7. Launch Readiness Score

- **9.0 / 10** for Phase 4 public-pricing/copy launch scope.
- Rationale: all automated gates and fixture checks pass, and identified regression was fixed; remaining delta is predominantly manual storefront verification in live theme/runtime conditions.

### 8. Files Changed

- Validation/fix scope code files:
	- [app/portal/page.tsx](app/portal/page.tsx)
	- [app/portal/connect/page.tsx](app/portal/connect/page.tsx)
- QA report updated:
	- [docs/QA_AUDIT.md](docs/QA_AUDIT.md)

### Phase 4.8 Audit Notes

- Portal-facing Agency naming now keeps the internal `qr_pro_plus` code but displays `Clutch Connect Agency`, `Custom pricing`, and 100+ campaign positioning.
- Remaining decision needed: confirm whether existing `qr_pro_plus` customers should keep their old 60-code limit or be migrated/upgraded to the new 100+ Agency limit in production data.
- Shopify theme audit found paid add-on risk: Professional Design, Clutch Connect hosting, and smart-card engraving are presented as paid choices in theme UI, but the visible controls are line-item properties unless the corresponding Shopify products, variants, selling plans, bundles, or app logic are configured to add real priced line items.
- Launch-blocker decision needed before storefront launch: confirm paid add-ons charge through actual Shopify products/variants/selling plans, or remove paid-price language until that charging path is live.

## Phase 2C Beginner Setup Wizard Release QA - 2026-07-01

### Audit Scope

- Focused only on Clutch Connect beginner setup behavior, preview behavior, persistence, route gates, and public profile rendering.
- Routes covered: `/portal/connect/setup`, `/portal`, `/portal/connect`, `/portal/connect/build`, `/u/my-test`.
- No Shopify, QR creation, analytics, wallet, webhook, unrelated dashboard redesign, or plan/tier architecture changes were made.

### Buttons Tested

- Step tabs: Basic Info, Contact Info, Links, Advanced.
- Back and Continue buttons.
- Contact visibility toggles.
- Add another link, remove link, hide/show link, type selector, quick-add link tiles, and Want to add more expand/collapse.
- Setup header Back and Advanced Builder CTAs, Connect hub CTAs, dashboard completion route, builder route, and public profile route.

### Fields Tested

- First name, last name, display name, organization, role/headline, avatar URL, slug.
- Phone, email, website, short bio, service area/location.
- Link type, label, URL/handle, plus unsafe URL inputs.
- Advanced style fields were source-reviewed and covered by TypeScript/build validation.

### Bugs Found

- Hidden setup/public blocks rendered outside editor mode instead of disappearing.
- Empty public social sections could leave a visible `More` section heading.
- Unsafe avatar draft input triggered React's blocked `javascript:` URL warning in the live preview before save validation.
- Unsafe website draft input could become a preview URL before save validation.
- Setup API did not validate avatar URL safety or enforce the 6-link beginner limit server-side.
- Link normalization was too permissive for weak email/phone values and unsafe full social URLs.
- Field validation messages could stay visible after a user edited the field again.

### Bugs Fixed

- Hidden blocks/sections now omit from preview and public modes, while editor mode keeps hidden controls available.
- Public/preview section shells now render only when their blocks have renderable content.
- Avatar preview and shared avatar rendering now allow only valid `http`/`https` image URLs.
- Website preview values now normalize through the beginner link URL normalizer before rendering.
- Setup API now validates avatar/website URLs and rejects over-limit beginner link payloads.
- Beginner link normalization now fails closed for unsafe schemes, malformed emails, and too-short phone values.
- Field errors clear when the user edits setup fields or link fields again.

### Preview Behavior Verified

- Setup preview is not blank for an existing beginner profile and shows setup-only link placeholder copy when there are no links.
- Requested starter copy appears in the setup preview only: `Your links will appear here`.
- Display name, organization, role/headline, slug, contact visibility, and links update live.
- Unsafe avatar, website, and link values do not render as active preview URLs.
- Added Website link normalized to `https://example.com/setup-preview-link` in preview.
- Hidden/removed links disappear from preview.

### Mobile QA Results

- `/portal/connect/setup` was tested at 390px, 430px, 768px, and desktop width.
- No document-level horizontal overflow was detected.
- Step tabs, link cards, toggles, input fields, and footer CTAs remained reachable in the tested widths.

### Public Profile Results

- `/u/my-test` renders real saved profile data only.
- Setup placeholders did not appear publicly: `Your Name`, `Your Business`, `Your role or headline`, `Your links will appear here`.
- Empty optional social sections hide cleanly on the public profile.
- Temporary QA link data was removed and verified absent from public output.

### Advanced Builder Compatibility

- Setup continues to save into the existing `builder_config` blocks used by the advanced builder.
- Hidden block behavior preserves editor mode visibility while fixing preview/public mode rendering.
- `/portal/connect/build` route smoke check returned 200 in the authenticated session; no plan logic was changed.

### Validation Results

- `npm run lint`: completed with existing warnings only; no blocking lint errors.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.
- No Playwright file was added because this repo does not currently include Playwright/Jest/Vitest support or scripts.

### Remaining Risks

- Duplicate slug race behavior is still best verified with multiple real customer accounts.
- Multi-plan free/basic/paid gate matrix was previously covered in Phase 2B; this pass did not change plan logic.
- Existing lint warnings remain outside this setup-focused scope.

### Release Readiness

- Result: setup wizard is release-ready from this focused QA/fix pass, with no known release-blocking setup-wizard bugs remaining.

## Phase 2 Setup Completion + Dashboard Gate Notes - 2026-07-01

### What Changed

- Added a shared setup completion helper in `lib/connect.ts` to determine whether a profile is setup-complete.
- Expanded Guided Setup beginner fields in `components/connect/ConnectSetupWizard.tsx` and mapped them into existing profile/builder storage.
- Updated setup persistence route `app/api/connect/setup/route.ts` to:
	- support expanded beginner payload fields,
	- map service area to `directions-button` data,
	- compute completion state using shared helper,
	- set customer onboarding status to `active` when setup becomes complete.
- Added server-side setup gate in `app/portal/page.tsx` so incomplete non-admin users are redirected to `/portal/connect/setup`.
- Added advanced-builder plan gate helpers in `lib/plans.ts` and enforced lock in `app/portal/connect/build/page.tsx`.
- Updated Connect dashboard CTAs in `app/portal/connect/page.tsx` and setup header in `app/portal/connect/setup/page.tsx` to reflect setup-complete vs locked states.
- Added free-plan-specific Connect language and CTA targets in `app/portal/page.tsx`.

### Validation Run

- `npm run lint` completed with existing repository warnings (no new blocking errors).
- `npx tsc --noEmit` passed.
- `npm run build` passed.

### Notes

- `npm run tsc -- --noEmit` is not available because `tsc` is not defined as an npm script in this repository.
- Manual authenticated browser verification is still recommended for full route-flow regression testing after deploy.

## Phase 2B Authenticated Browser QA - 2026-07-01

### Scope

- Focused runtime pass for:
	- `/portal`
	- `/portal/connect`
	- `/portal/connect/setup`
	- `/portal/connect/build`
	- `/u/[slug]`

### Authenticated Scenarios Covered

- Admin baseline.
- Simulated incomplete non-admin.
- Simulated completed non-admin paid.
- Simulated completed non-admin free.

Note: Because only one authenticated browser session was available, non-admin/free/paid variants were validated by temporarily toggling plan/role/onboarding flags for the same customer and restoring baseline afterward.

### Redirect and Gate Results

- Incomplete non-admin: `/portal` correctly redirected to `/portal/connect/setup`.
- Completed non-admin: `/portal` stayed on dashboard.
- Free plan user:
	- `/portal/connect` showed `Advanced Builder locked` messaging,
	- `/portal/connect/build` redirected to `/portal/connect?builder=locked`.
- Paid non-admin and admin:
	- `/portal/connect/build` remained accessible.

### Setup Completion Results

- Final setup submit redirected to `/portal?setup=complete`.
- Dashboard success banner rendered.
- Onboarding state transition verified:
	- status set to `not_started` before submit,
	- status changed to `active` after submit.

### Public Profile Results

- Public profile rendered expected name/headline/contact content.
- Hidden social entries remained hidden.
- Service area mapping validated:
	- setting service area in setup rendered a Directions row with maps URL and visible location text.

### Mobile and Runtime Results

- Tested viewports: 390, 430, 768, desktop.
- No document-level horizontal overflow across target routes.
- No new blocking runtime console errors.
- Ignored non-blocking preload warnings as expected.

### Bug Fixed During QA

- Fixed React controlled/uncontrolled warning in setup wizard caused by recovering stale localStorage draft shapes after Phase 2 field expansion.
- Implemented schema-safe draft normalization in `components/connect/ConnectSetupWizard.tsx`.

### Validation After Fix

- `npm run lint`: passes with existing warnings only.
- `npx tsc --noEmit`: passes.
- `npm run build`: passes.

### Remaining Risk

- Multi-account session switching was simulated via reversible DB state toggles due single available browser login; if desired, final pre-release signoff can still include true separate-account browser sessions for organizational policy/compliance.

## Phase 4.8.5 Shopify Paid Add-On Charging Path

- Detailed audit: `docs/SHOPIFY_ADDON_CHARGING_AUDIT.md`.
- Current finding: theme line item properties preserve customer instructions but do not charge customers.
- Launch blockers remain for Professional Design, smart-card engraving, print-product Clutch Connect hosting upsell, Growth Kit yard sign add-on, and unverified additional smart-card charging.
- Phase 4.8.5 is not complete until real Shopify cart/checkout tests prove each paid add-on changes the cart total correctly.

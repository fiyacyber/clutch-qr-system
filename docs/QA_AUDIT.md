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
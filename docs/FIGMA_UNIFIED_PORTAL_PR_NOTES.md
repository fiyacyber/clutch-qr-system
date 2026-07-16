# Unified Customer Portal — PR Notes

## Architecture summary

This change redesigns the existing authenticated application in place. `DashboardShell` now presents exactly five customer navigation destinations for every eligible account: Dashboard, Marketing, Contacts, Orders, and Account. Existing routes remain the implementation surfaces beneath those parents. Administrators retain a separate utility link.

`accountAccess` still controls actions, locks, data scope, allowances, and upgrade prompts. It no longer selects a different navigation shell. Connect+, Clutch Codes subscriptions, and order-linked/Business Kit access remain independent and union only their legitimate capabilities.

The Dashboard uses owned Supabase records for every metric and state. No Figma placeholder customer, order, notification, metric, or chart value is included.

The print workflow adds a distinct order-linked QR setup and “Send QR to Artwork” path. Draft saves atomically update only the working QR and order-linked placement preferences. Submission first performs a service-only locked preflight, stores a deterministic idempotency-key asset, then re-locks and transactionally updates the working QR, snapshots placement, and registers an immutable revision. Failed registration removes an object created by that request. It is not a `customer_artwork` upload. Later draft edits cannot mutate submitted revisions; sending the complete artwork proof locks new QR revisions while an identical successful retry still returns its original revision and file.

## Route mapping

| Primary section | Primary route | Existing child routes |
| --- | --- | --- |
| Dashboard | `/portal` | Production metrics, performance, tasks, campaigns, leads, activity, Create New |
| Marketing | `/portal/qr` | `/portal/create`, `/portal/analytics`, `/portal/heatmap`, `/portal/connect`, builder/setup routes |
| Contacts | `/portal/connect/leads` | Lead forms, CRM states, exports, source insights |
| Orders | `/portal/print-orders` | `/portal/print-orders/[id]`, artwork, QR setup, proofs, production, shipping |
| Account | `/portal/settings` | `/portal/subscription`, `/portal/pricing`, security/profile/billing settings |

## Entitlement matrix

| Account | General QR creation | Order-linked setup | QR styling | Logo | Campaign analytics | Connect builder |
| --- | --- | --- | --- | --- | --- | --- |
| Starter/Growth/Pro | Plan allowance | Owned orders | Yes | Yes | Plan scope | Only with separate Connect+ |
| Connect+ only | No | Only if separately owned | Owned eligible assets | No general QR logo right | Profile scope | Yes |
| Active 90-day print | No | Owned linked item only | Scan-safe order setup | Only with separate eligible plan | Basic owned-code scope | No |
| Expired 90-day print | No | Read-only | Locked | Locked | Locked | No |
| Business Kit | No unrelated capacity | One task per trusted component | Owned component setup | Only with separate eligible plan | Basic owned-code scope | No |
| Combined account | Union of valid rights | Owned linked items | According to each right | According to plan | Union of valid scopes | If Connect+ |
| Admin | Unlimited | All | Yes | Yes | All | Yes; admin tools remain separate |

## Database migration

`20260715213000_add_print_qr_artwork_submissions.sql`:

- adds QR setup state to `print_order_items`;
- adds order-linked placement mode, side, position, instructions, and optional print-size preferences;
- adds the append-only `print_qr_artwork_versions` table;
- adds the distinct `qr_artwork_asset` private file kind;
- enables RLS and owned-order/admin read policies;
- keeps all writes service-role-only;
- removes the unreliable legacy JWT-claim role check while retaining `SECURITY DEFINER`, empty search paths, explicit revokes, service-role-only execute grants, and strict actor/ownership validation;
- performs locked preflight and final validation, then registers the working QR update, placement snapshot, frozen file/version, item state, and idempotent activity in one transaction;
- associates each proof with the QR revision, destination, placement note, page labels, and scan-validation state it contains;
- prevents any non-proof-approval transition from moving an order to `ready_for_production`;
- marks a newly provisioned eligible item as setup-required;
- synchronizes artwork-use state when a proof is sent or approved.

Apply the migration before serving this application revision.

## Visual reference and screenshots

Visual source: [approved Figma Make customer dashboard](https://www.figma.com/make/bWJAoxU376B9Tb7Gq2srUN/Interactive-Customer-Dashboard-Prototype).

The implementation now follows the exported Make `App.tsx` shell directly: a 214px solid navy sidebar, compact five-item navigation, white active row, plan usage card, Help/Support/Log out utilities, sticky 72px top bar, mobile bottom navigation, and the source card/spacing hierarchy. It uses the approved navy `#384862`, orange `#FFA665`, background `#F5F7FA`, border `#E3E8EF`, muted text `#667085`, Exo 2 headings, Montserrat body, restrained shadows, 8–16px radii, 44px targets, focus states, and reduced motion.

Local source-to-implementation comparisons are checked in at [1440px](../artifacts/figma-visual-comparison/side-by-side-1440.png) and [390px](../artifacts/figma-visual-comparison/side-by-side-390.png), with the Figma Make export on the left and the application shell/layout fixture on the right. The fixture intentionally omits authenticated values; production routes continue to use the existing application queries. Authenticated workflow screenshots still require representative staging data and remain part of the manual staging pass.

## Automated validation

- `npm ci` — passed; npm reports 9 dependency audit findings (4 moderate, 5 high) in the existing latest-version dependency graph.
- `npm test` — passed, including subscription, Connect, account access, tracked-print, Business Kit, print production, order-linked expiry/redirect, route ownership, QR draft/render/submission, migration, and five-nav assertions.
- `npm run test:print-qr-artwork:integration` against a fresh local Supabase stack — passed for service-role PostgREST execution without the legacy claim, same-key duplicate/concurrent submission, distinct concurrent revisions, proof-approval races, placement persistence, frozen draft separation, QR-to-proof association, and owner/admin/wrong-customer access.
- Fresh `supabase db reset --local --no-seed` — passed for the complete migration chain; `supabase db lint --local --level warning` reported no schema errors.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with 48 pre-existing warnings and zero errors; changed files add no lint warnings.
- `npm run build` — passed with Next.js 16.2.9.
- `git diff --check` — passed.

## Known limitations

- Local 390px and 1440px comparisons validate the shell, type hierarchy, cards, navigation, responsive behavior, touch targets, and absence of horizontal overflow. The data-backed authenticated workflow pass remains a staging gate because no test customer records were added merely to manufacture screenshots.
- Transactional email delivery depends on the existing Resend configuration. Submission remains committed if a notification provider fails, and the idempotent order activity remains available for operational retry/audit.
- General campaign grouping remains backed by existing QR/profile/order records; this change does not invent a new campaign table.
- QR artwork output is a 2400px-equivalent vector SVG. PNG/PDF customer exports remain available through the existing QR exporter; the frozen production source is SVG.

## Manual staging test plan

1. Apply the additive migration to staging, then deploy this branch to a preview only.
2. Sign in as Starter, Growth, Pro, Connect+-only, active 90-day print, expired 90-day print, Business Kit, combined, and admin accounts.
3. At desktop and mobile widths, verify the same five-item shell, correct active parent, separate admin utility, 44px targets, keyboard focus, Escape-to-close, reduced motion, loading, empty, error, and locked states.
4. Compare Dashboard, Marketing, Contacts, Orders, Account, Create New, chart filters, drawers/sheets, and typography/color/spacing against the approved Figma Make source. Capture desktop and mobile screenshots for the PR.
5. Verify every displayed number against the customer's Supabase rows; verify unavailable queries show a retry notice and never demo values.
6. Confirm Connect+ alone cannot create a general code, Clutch Codes alone does not get Connect+, and included/Business Kit codes do not become subscription capacity.
7. For each Business Kit component, verify one ordinary order row and one independent QR setup task tied to its item/provisioning/QR/material.
8. Validate a destination, save a QR draft, refresh, and confirm the saved design and immutable slug.
9. Submit revision 1; download the private SVG as customer and admin; verify a different customer receives 404.
10. Change the working draft after submission and confirm revision 1's design, placement snapshot, SVG, and checksum are unchanged. Resubmit before the proof is sent and confirm revision 2 supersedes revision 1 without deleting history.
11. Upload a complete proof with front/back or page labels and passed QR scan validation. Confirm inline image/PDF viewing, zoom, destination, placement note, and QR revision association. Send it, then approve through the complete-artwork acknowledgment; confirm only that approval reaches `ready_for_production` and new QR submissions return 409.
12. Expire order-linked access and confirm order/submitted asset/redirect remain visible while editing and analytics lock. Scan the printed short URL and confirm redirect and ingestion continue.
13. Replay the paid Shopify webhook and confirm no duplicate print item, QR, allowance, provisioning, activity, or setup task.
14. Verify customer and operations submission emails in a staging environment with Resend and `PRINT_OPERATIONS_EMAIL` configured.

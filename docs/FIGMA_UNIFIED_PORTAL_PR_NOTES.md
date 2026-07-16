# Unified Customer Portal — PR Notes

## Architecture summary

This change redesigns the existing authenticated application in place. `DashboardShell` now presents exactly five customer navigation destinations for every eligible account: Dashboard, Marketing, Contacts, Orders, and Account. Existing routes remain the implementation surfaces beneath those parents. Administrators retain a separate utility link.

`accountAccess` still controls actions, locks, data scope, allowances, and upgrade prompts. It no longer selects a different navigation shell. Connect+, Clutch Codes subscriptions, and order-linked/Business Kit access remain independent and union only their legitimate capabilities.

The Dashboard uses owned Supabase records for every metric and state. No Figma placeholder customer, order, notification, metric, or chart value is included.

The print workflow adds a distinct order-linked QR setup and submission path. Drafts update the live QR record after strict authorization. Submission renders a scan-safe SVG from the permanent short URL, stores it in private print storage, and transactionally registers an immutable revision. It is not a `customer_artwork` upload. Later style edits do not mutate submitted revisions; proof approval locks resubmission.

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
- adds the append-only `print_qr_artwork_versions` table;
- adds the distinct `qr_artwork_asset` private file kind;
- enables RLS and owned-order/admin read policies;
- keeps all writes service-role-only;
- registers a frozen file, version, item state, and idempotent order activity in one RPC;
- marks a newly provisioned eligible item as setup-required;
- synchronizes artwork-use state when a proof is sent or approved.

Apply the migration before serving this application revision.

## Visual reference and screenshots

Visual source: [approved Figma Make customer dashboard](https://www.figma.com/make/bWJAoxU376B9Tb7Gq2srUN/Interactive-Customer-Dashboard-Prototype).

The implementation follows the approved navy `#384862`, orange `#FFA665`, Exo 2/Montserrat type system, restrained cards, desktop sidebar proportions, responsive metric cards, full-screen mobile Create New sheet, mobile bottom navigation, 44px targets, focus states, reduced motion, loading skeletons, empty states, errors, and live status notices.

Authenticated implementation screenshots require a staging environment with the new migration and representative owned customer/order data. No repository secrets or demo records were introduced merely to manufacture screenshots. Capture the dashboard and workflow screenshots in the manual staging pass below before moving the PR out of draft.

## Automated validation

- `npm ci` — passed; npm reports 9 dependency audit findings (4 moderate, 5 high) in the existing latest-version dependency graph.
- `npm test` — passed, including subscription, Connect, account access, tracked-print, Business Kit, print production, order-linked expiry/redirect, route ownership, QR draft/render/submission, migration, and five-nav assertions.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with 48 pre-existing warnings and zero errors; changed files add no lint warnings.
- `npm run build` — passed with Next.js 16.2.9.
- `git diff --check` — passed.

## Known limitations

- Authenticated visual screenshots were not generated locally because this checkout intentionally contains no Supabase credentials, migrated staging database, or test customer login. The build and source-level responsive checks are complete; the data-backed visual pass remains a staging gate.
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
10. Change the draft style after submission and confirm revision 1's SVG/checksum is unchanged. Resubmit before proof approval and confirm revision 2 supersedes revision 1 without deleting history.
11. Send a proof and confirm the current QR version is marked placed in artwork. Approve the proof and confirm it is proof-locked and further QR submission returns 409.
12. Expire order-linked access and confirm order/submitted asset/redirect remain visible while editing and analytics lock. Scan the printed short URL and confirm redirect and ingestion continue.
13. Replay the paid Shopify webhook and confirm no duplicate print item, QR, allowance, provisioning, activity, or setup task.
14. Verify customer and operations submission emails in a staging environment with Resend and `PRINT_OPERATIONS_EMAIL` configured.

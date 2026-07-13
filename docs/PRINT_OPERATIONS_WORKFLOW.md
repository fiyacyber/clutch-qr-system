# Print Operations Workflow

Phase 3 adds the private artwork, proof, production, and fulfillment workflow for normalized Phase 2 `print_order_items`. It does not alter Shopify, send email, enable tracked-print products, redesign Clutch Codes plans, or change any already-applied Phase 2 migration.

## Storage and authorized access

The `print-order-files` Supabase Storage bucket is private, limited to 25 MB per object, and allows PDF, PNG, JPEG, WebP, SVG, EPS, and AI content types. Object paths are scoped as `{print_order_item_id}/{file_kind}/{generated_uuid}.{extension}`. Original filenames are metadata only and never form the object path.

Customers and administrators upload through authenticated Next.js server routes. Those routes verify the order relationship before using the server-only service role. The database RPC repeats the customer ownership or administrator check against the acting Auth user. If object upload succeeds but database registration fails, the route removes the object.

No public or authenticated `storage.objects` policy is created. Downloads go through `/api/print-order-files/[fileId]`, which authorizes the user against the owning print order and then redirects to a five-minute signed URL. Public Storage URLs are never used.

## Data model

`print_order_files` stores immutable private-object metadata, checksum, actor, idempotency key, and current/superseded state. A partial unique index permits only one current file of each kind per order.

`print_proofs` stores sequential revisions. Exactly one proof can be current. Uploading a revised proof atomically supersedes the prior current proof and creates the next draft revision.

`print_order_items.workflow_state` is the centralized source of operational state. Existing Phase 2 artwork, proof, production, and fulfillment columns remain synchronized for compatibility. Supplier, production, shipment, and delivery timestamps are recorded on the order. Every accepted file or transition adds a sanitized `order_activity` event in the same database transaction.

## State machine

The normal path is:

`awaiting_artwork → artwork_received → artwork_review → proof_preparing → proof_sent → ready_for_production → submitted_to_supplier → in_production → production_complete → fulfilled → delivered`

Artwork review may move to `artwork_changes_requested`, after which a customer can upload another artwork revision. A sent proof may move to `proof_changes_requested`, after which an administrator can upload a revised proof. Administrators can cancel any workflow that is not already delivered or cancelled.

Only `register_print_order_file` and `transition_print_order_workflow` mutate Phase 3 state. Both functions are fixed-search-path, service-role-only RPCs with execution revoked from `public`, `anon`, and `authenticated`. They lock the order row, validate the actor, enforce the transition, update compatibility fields and timestamps, and write the audit event atomically.

## Customer workflow

`/portal/print-orders/[id]` is server-authorized by both the session customer and the order's `customer_id`. It supports:

- artwork upload while artwork or proof revisions are requested;
- private access to current customer artwork and proof files;
- proof approval or a required revision explanation;
- production, fulfillment, and shipment visibility;
- customer-safe order activity.

Customers cannot directly mutate database workflow rows, upload admin/supplier files, access other customers' orders, or create signed links for another order.

## Administrator workflow

`/admin/print-orders/[id]` requires `customers.is_admin=true`. It supports:

- artwork review, approval, and revision requests;
- proof upload, version history, and marking the proof sent for portal review;
- supplier and supplier-order references;
- production start and completion controls;
- carrier, tracking number, tracking URL, fulfillment, and delivery controls;
- private file and full sanitized audit history.

"Send proof" changes the portal-visible workflow state only. Phase 3 intentionally sends no email.

## Security and rollout

Both new tables use RLS. Authenticated reads require either an order-owned customer whose `auth_user_id` equals `auth.uid()` or the existing administrator predicate. Client writes are revoked. Application routes use the same ownership checks before service-role operations, and database functions enforce them again.

Apply `20260713043811_print_operations_workflow.sql` only after the three Phase 2 tracked-print migrations. Validate it against a fresh schema and the current staging schema before any production rollout. No new environment variable is required.

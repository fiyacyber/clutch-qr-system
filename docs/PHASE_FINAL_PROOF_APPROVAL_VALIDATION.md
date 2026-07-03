# Final Phase Validation Notes: Proof Approval Workflow

Use this checklist to validate the final Smart Business Card proof approval flow.

## Admin flow
- [ ] Admin can enter approver name, approver email, proof URL, and approval notes in `/admin/card-orders`.
- [ ] Admin can generate a proof token when missing.
- [ ] Admin can copy the proof review link.
- [ ] Admin can send proof approval email manually.
- [ ] Admin dashboard shows updated approval status and timestamps after sending.

## Approver flow
- [ ] Approver can open `/proof/card-order/[proof_token]` without login.
- [ ] Opening the proof page sets `proof_viewed_at` when first viewed.
- [ ] If status is `sent`, first view moves status to `viewed`.
- [ ] Approver can approve proof and sees:
  - `Proof approved. Your card is ready for production.`
- [ ] Approver can request changes with required notes and sees:
  - `Changes requested. We’ll review your notes and send an updated proof.`

## Data integrity checks
- [ ] `approval_status` transitions are reflected on `card_orders`.
- [ ] `customer_approved_at` is set on approval.
- [ ] `changes_requested_at` and `approval_notes` are set on change requests.
- [ ] Existing engraving fields and onboarding data remain unchanged.
- [ ] No onboarding emails are sent by this phase.

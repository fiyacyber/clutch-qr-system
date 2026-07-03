# Phase 6 Guided Setup Routing Tests

## Scope
Validate post-login onboarding routing for Smart Business Card customers into the existing Guided Setup flow.

## Test Cases
1. New customer from setup link
- Open /login?next=/setup/guided
- Sign in with a customer account that has guided_setup_required=true
- Expect redirect to /portal/connect/setup

2. Password-required customer
- Set customer onboarding_status=password_required or must_change_password=true
- Open /login?next=/setup/guided and sign in
- Expect redirect to /account/change-password?next=/setup/guided
- Change password
- Expect redirect to /portal/connect/setup

3. Guided setup completion
- Complete required Guided Setup steps and submit
- Expect redirect to /portal/connect
- Verify customer fields updated where columns exist:
  - onboarding_status complete (or fallback active if enum does not support complete)
  - guided_setup_required=false
  - setup_step updated
- Verify profile setup_completed=true if column exists

4. Completed customer login
- Use an account with setup complete and guided_setup_required=false
- Open /login?next=/setup/guided and sign in
- Expect redirect to /portal/connect (not forced through setup)

5. Unauthenticated access to setup
- Open /portal/connect/setup while logged out
- Expect redirect to /login?next=/setup/guided

6. Safe next parameter enforcement
- Open /login?next=https://evil.example
- Sign in successfully
- Expect fallback to internal route (/portal or onboarding-driven route), not external redirect

## Local diagnostics
In local development, server logs include safe routing diagnostics:
- auth_user_id_exists
- customer_onboarding_status
- guided_setup_required
- setup_completed
- final_redirect_path

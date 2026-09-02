# Automation Phase 2D staging validation

This checklist is intentionally non-production. Do not use the repository's currently configured project reference until its environment has been positively identified. No migration, function deployment, secret change, or scheduler installation was performed during Phase 2D local work.

## Required before validation

- Install compatible Supabase CLI and Deno versions. Neither executable was available on the Phase 2D workstation.
- Provision or identify a dedicated non-production Supabase project and obtain explicit approval to use it.
- Authenticate the CLI to the staging organization and link the repository to the staging project reference only.
- Record the staging frontend URL in `PUBLIC_SITE_URL` for `qr-redirect`.
- Configure staging-only provider credentials if provider adapter implementations are added. Phase 2D deliberately ships no fake email, SMS, notification, appointment-confirmation, or ticket-confirmation provider.
- Decide on a staging scheduler/worker for `claim_due_automation_jobs`. The migration creates the locked claim boundary but installs no cron and no production worker.
- Supply representative staging accounts: two owners, one assigned editor, one unassigned editor, and one platform admin.

## Safe validation order

1. Confirm `git branch --show-current` is `codex-development`, the approved commit is checked out, and the tree contains only the reviewed Phase 2D diff.
2. Confirm the linked Supabase project URL/ref is the dedicated staging project. Stop if it resembles or resolves to production.
3. Create a database backup/restore point in staging.
4. Run a dry-run migration diff, then apply pending automation migrations to staging only.
5. Regenerate Supabase TypeScript types from staging and review the diff before retaining it.
6. Deploy `automation-engine` and `qr-redirect` to staging only. Set `PUBLIC_SITE_URL` to the staging web origin.
7. Seed isolated test records through normal trusted application paths; never copy production secrets or sensitive customer payloads.
8. Validate owner CRUD, assigned-editor flyer-scoped CRUD, unassigned-editor denial, admin definition/history read access, and admin mutation denial.
9. Validate form, website form, subscriber/lead, appointment, flyer, bizad, and QR events. Confirm the event/execution account always comes from the resolved resource.
10. Attempt cross-account source, automation-chain, execution-history, and mutation attacks using both browser calls and direct REST calls.
11. Replay identical event keys and verify one event/execution. Test stale/future timestamps, malformed JSON, source IDs over 500 bytes, bodies over 64 KiB, and more than 120 events/resource/minute.
12. Confirm ticket completion returns `verified_payment_required`; do not enable it until a signed provider webhook creates the trusted completion event.
13. Confirm unconfigured provider actions fail as `provider_not_configured` and that history/logs contain no credential material.
14. Create WAIT jobs and inspect immutable version, account, correlation, next position, and idempotency values. Do not advertise WAIT as operational until an approved staging worker resumes jobs successfully and retry/lease recovery tests pass.
15. Exercise customer and admin history filters, pagination, step ordering, durations, failure/skipped states, safe errors, and recursive secret redaction.
16. Run focused tests, full tests, TypeScript, targeted ESLint, production build, and `git diff --check` against the staging-ready commit candidate.

## Gateway/platform controls still required

- Enforce request body and connection limits before Edge Functions.
- Add IP/device reputation limits and bot protection for anonymous flyer, form, and QR traffic.
- Centralize request IDs and security monitoring without logging payloads or authorization headers.
- Alert on sustained 429s, cross-account resolution failures, job lease churn, provider failures, and webhook signature failures.
- Configure staging and production secrets independently, with least privilege and documented rotation.

## Event integration boundaries

- Forms and leads: an event is emitted only after a database row exists; the engine re-resolves flyer/account ownership from that row.
- QR: `qr-redirect` accepts only a flyer slug, resolves the published flyer server-side, emits `qr_scanned`, then redirects to the server-derived flyer route. Existing QR generators must be deliberately migrated to this endpoint after staging validation.
- Payments/tickets: browser claims are rejected. Remaining work is a provider-specific signed webhook that verifies the provider event, resolves the purchase and account server-side, and submits an idempotent internal event.
- Providers: adapters receive server-derived account, correlation, and idempotency context. Real adapters and secrets remain future configuration work.
- WAIT/retry: durable tables and an atomic `FOR UPDATE SKIP LOCKED` claim function exist. A reviewed worker/resume implementation and scheduler remain required.

## Recommended eventual deployment procedure

After staging sign-off: review the final diff and generated types, commit on `codex-development`, open a reviewed change request, back up production, apply migrations during a monitored window, deploy functions with production-specific secrets, run read-only/RLS smoke tests, enable event sources incrementally, then enable any separately reviewed worker/provider integrations. Keep ticket completion and provider actions disabled until their verified implementations are present. Roll back by disabling event/function routing and workers first; use a reviewed forward migration for schema corrections rather than destructive rollback.

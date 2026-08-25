# Stop cross-project / cross-account data bleed

## What I verified first

- The current project is **TOGETHER MEMPHIS** (flyer `0656d563…`, job "TOGETHER MEMPHIS").
- Its saved Website page contains **no** "Vontastic" text, and every image on it points to this project's own storage folder.
- "Vontastic's" exists in the database as a separate flyer + job + business card, and those rows are currently stored under the **same account id** as TOGETHER MEMPHIS (`showoffgrafixs@gmail.com` / Sherman Bowen).

So the leak is not hardcoded text: either data is being pulled across projects at generation time, or the Vontastic records are attached to the wrong account. Both get addressed.

## The rule (to be enforced everywhere)

Every project uses only its own data. Never another project, never another account — even when the same person owns both.

Allowed for a project: that project's onboarding, its business card, its flyer pages/layers/images, its job record, its approved testimonials, its uploaded assets.

Not allowed: another project's onboarding or business card, the account's "latest onboarding" from a different project, another project's images or thumbnails, another account's anything.

## What will be done

1. **Save the rule as a permanent project memory** so every future change follows it automatically.
2. **Audit and fix the data loaders** so no code path can reach outside the current project:
   - Remove the account-wide "latest onboarding" fallback used when a project has no onboarding of its own. If a project has no onboarding, its website shows placeholders instead of another project's business.
   - Keep the account profile row (name, email, phone, photo) only where it is genuinely account-level, and never let it supply a business name, description, logo, or images.
   - Confirm business card, job, testimonials, images and social links are all filtered by this project's id.
3. **Add a guard when the Website page is generated**: any value whose source project id does not match the current project is dropped before it is written into the page.
4. **Ownership check for the Vontastic records**: confirm which account those rows should belong to. If they are attached to the wrong account, move them to the correct one and confirm the flyer, job, business card and onboarding all agree.
5. **Verify** by regenerating the TOGETHER MEMPHIS website and confirming no Vontastic name, logo, image or link appears anywhere.

## Technical notes

- `src/lib/websiteSources.ts`: drop `dashboardOnboarding` (`getMyOnboarding(clientId)`) from the source set; keep `projectOnboarding` (job-scoped), `bizad` (flyer-scoped), `job` (flyer-scoped), and testimonials (flyer-scoped). Restrict `clientProfile` to contact-only fields.
- `src/lib/websiteProfile.ts`: remove every `dash?.*` fallback in `first(...)` chains for business identity/contact/logo/description; keep `client?.*` only for owner name/phone/email.
- Add a small assertion helper in `websiteSources.ts` that asserts each fetched row's `flyer_id` / `flyer_job_id` matches the current flyer/job, and discards mismatches.
- Also audit the same fallback pattern in the chatbot knowledge sync, marketing scripts, and business-card generation so they follow the identical per-project rule.
- Ownership move (step 4) would be a data update on `flyers.owner_id` / `jobs.user_id` for the Vontastic rows, done only after you confirm the target account.

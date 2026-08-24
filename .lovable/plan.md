# Fix onboarding save error (no unique constraint)

Saving the onboarding form fails because the app saves one onboarding per project, but the database rule only enforces uniqueness on rows that already have a project attached. Postgres can't match that partial rule, so the save is rejected.

## What will change

1. Delete the 4 legacy onboarding records that have no project attached:
   - Gulayan (Jul 27)
   - Aceroofing enterprises (Aug 20)
   - Vontastic's (Aug 21)
   - Express T-shirts & Graphics (Aug 23)
2. Replace the partial unique index on `flyer_job_id` with a full unique constraint so each project has exactly one onboarding record and saving works.
3. Re-test saving the onboarding form for the current project.

## Technical detail

- `DELETE FROM public.onboarding_submissions WHERE flyer_job_id IS NULL;` (run via data tool)
- Migration: `DROP INDEX public.onboarding_submissions_flyer_job_id_key;` then
  `ALTER TABLE public.onboarding_submissions ADD CONSTRAINT onboarding_submissions_flyer_job_id_key UNIQUE (flyer_job_id);`
- `flyer_job_id` stays nullable, but any future row without a project would then collide with another such row; `submitOnboarding` already always sets it, so no code change is needed.

## Note

Deleting these records is permanent. Each affected business will need to fill out onboarding again from its own project.

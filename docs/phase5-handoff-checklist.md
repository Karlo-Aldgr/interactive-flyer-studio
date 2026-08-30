# Phase 5 — Handoff checklist

## What was shipped (this session)

1. **Homepage** — Command-station messaging + 6-card "Everything in one place" section (`Landing.tsx`)
2. **Submit job** — "I'd rather you choose for me" option (`staff_choice` in `selected_actions`)
3. **Onboarding** — Service-interest checkboxes (automation/marketing, bizad, website)
4. **Bizad AI** — `FlyerChatbot` on published `/bizads/{slug}` pages
5. **Admin display** — Service interests visible in onboarding card; staff-choice label in job views

## Database migration required

Run in **Lovable** (or Supabase SQL editor):

`supabase/migrations/20260830120000_onboarding_service_interests.sql`

Adds `service_interests text[]` to `onboarding_submissions`.

## Test checklist (run after deploy)

| # | Item | How |
|---|------|-----|
| 1 | Clients portal | Sign in → Clients portal → Open portal on paid/completed project |
| 2 | Email auth | New signup → verify email |
| 3 | Homepage | Confirm command-station CTA + 6 offering cards on tapthatflyer.com |
| 4 | Copy button style | Editor → button → Style tab; ask Mr Biggs to confirm meaning |
| 5 | Choose for me | Submit job with only that option → shows in admin |
| 6 | Onboarding options | Check services → save → visible in admin job onboarding card |
| 7 | Marketing | `/marketing` loads |
| 8 | Bizad | Editor bizad → public link works |
| 9 | Flyer AI | Published `/f/{slug}` → Ask AI |
| 10 | Bizad AI | Published `/bizads/{slug}` → Ask AI |
| 11 | Facebook | Eugene / Mr Biggs (blocked without Page access) |
| 12 | GitHub | Invite Dr as collaborator (see below) |

## GitHub collaborator invite

**Need:** Dr's GitHub username (not email/password).

```bash
gh api repos/Karlo-Aldgr/interactive-flyer-studio/collaborators/DR_GITHUB_USERNAME -X PUT -f permission=push
```

Or: GitHub → repo → Settings → Collaborators → Add people.

**Later (Eugene's plan):** Transfer repo to Dr's org/account and reconnect Lovable — after all edits are done.

## Discord message (copy/paste)

```
Sir — synced with Eugene's plan: finished the pending list items, then GitHub collaborator access (no password needed).

Shipped:
• Homepage updated — TapThatFlyer as your marketing command station, with all offerings listed (flyers, bizad, marketing, websites, portal, AI)
• Submit job — "I'd rather you choose for me" option
• Onboarding — checkboxes for AI automation/marketing, digital business card, and website
• Ask AI now on digital business card pages too

SMS auth skipped per your note. Email signup is unchanged.

Please test Clients portal on your account and confirm the error is gone. Quick question: for "copy button style" — is the editor button styling + link field what you meant?

Next: once you send Dr's GitHub username, I'll add him as a collaborator on the repo.
```

## Blocked / out of scope

- Facebook TapThatFlyer posting (needs Page access)
- SMS authentication (skipped per client)
- Hosted website AI (deferred; flyer + bizad AI done)
- Repo transfer to Dr's GitHub (after handoff testing)

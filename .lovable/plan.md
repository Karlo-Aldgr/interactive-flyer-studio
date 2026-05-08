## Poll Results dashboard

### 1. Real Analytics page (`src/pages/Analytics.tsx`)
Replace the placeholder with a results dashboard for the current flyer:
- Load flyer title + walk pages → layers → actions to find every `type = 'poll'` action.
- For each poll, query `poll_votes` filtered by `action_id` (RLS already lets the owner read all votes).
- Render per poll:
  - Question, "Multiple choice" badge when applicable
  - Bar per option with vote count + percentage (sorted desc)
  - Total votes + unique voters (`distinct session_id`)
  - "Export CSV" button (option label, votes, percentage)
- Realtime subscription on `poll_votes` filtered by `flyer_id` so results update live.
- Empty state when a poll has no votes.
- Header with back link to the editor and flyer title.

### 2. Editor entry points
- `src/components/editor/TopBar.tsx`: add a "Results" button (BarChart icon) that opens `/analytics/:flyerId` in a new tab.
- `src/components/editor/ActionEditor.tsx`: inside the poll editor block, add a small "View live results" link to the same route.

### Out of scope
- Click/view/form-submission analytics (poll-only for this pass).
- Vote moderation / per-voter identity (votes stay anonymous).

### Files touched
- `src/pages/Analytics.tsx`
- `src/components/editor/TopBar.tsx`
- `src/components/editor/ActionEditor.tsx`

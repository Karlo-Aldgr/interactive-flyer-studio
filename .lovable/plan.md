## Problem

The Dashboard at `/dashboard` is slow to load. Looking at `src/pages/Dashboard.tsx`, the initial query is:

```ts
supabase
  .from("flyers")
  .select("*, pages(index, layers(type, z_index, content))")
  .order("updated_at", { ascending: false });
```

This pulls **every layer's full `content` JSON across every page of every flyer** just to compute a fallback thumbnail when `thumbnail_url` is missing. `content` can include large blobs (image src strings, base64, settings, etc.), and PostgREST has to assemble a deep nested JSON tree. This is the dominant cost — even with only a handful of flyers, payload size and join cost grow fast as the user adds pages/layers.

The backend itself is healthy (Lovable Cloud status is normal, table sizes are tiny in raw bytes), so this is a frontend query-shape problem, not infrastructure.

## Fix

Rewrite the Dashboard data load to be lean:

1. **Primary query** — fetch only the columns the card grid uses, no nested relations:
   ```
   select id, title, status, public_slug, thumbnail_url, updated_at
   from flyers
   order by updated_at desc
   ```
2. **Lazy fallback thumbnail** — for the (usually small) subset of flyers where `thumbnail_url` is null, run a second targeted query that fetches just the first page's first image layer per flyer, in parallel with `Promise.all`. Cap to e.g. the first 12 missing-thumbnail flyers so a backlog can't stall the page.
3. **Render immediately** after step 1; let the fallback thumbnails fill in when they arrive (optimistic UI). The grid already handles a missing thumbnail with a placeholder icon.
4. Add a basic timeout / error toast so a hung request can't leave the spinner forever.

No schema or RLS changes. No change to flyer creation, duplication, deletion, or routing.

## Files to change

- `src/pages/Dashboard.tsx` — replace the `load()` implementation per above. Keep all UI, types, and other handlers (`create`, `remove`, `duplicate`, `copyLink`) unchanged.

## Out of scope

- No edge function changes.
- No changes to the editor, portal, or analytics flows.
- No design changes.

# Restore VONTASTIC'S and clear out blank projects

## What the data shows

VONTASTIC'S was never deleted. The original job (status "delivered") and its flyer are fully intact:

- Page 1 — 5 layers
- Landing — 1 layer
- Digital business card — 13 layers
- Published at slug `vontastic-s-eabtr`, business card record still enabled

What happened instead: a second, empty flyer named "Vontastic's" was created today at 14:22 (0 layers, no job attached). Opening that duplicate is what looks like "deleted".

Across the whole project there are only three blank items, not forty:

| Item | Type | Created | Layers |
|---|---|---|---|
| Vontastic's | flyer, no job (duplicate) | Aug 22 | 0 |
| Aceroofing enterprises | job + flyer, status "new" | Aug 20 | 0 |
| Gulayan | job + flyer, status "new" | Jul 27 | 0 |

(Three older cancelled jobs — Karlo testing, sample, Lionssss — were already deleted back in June and have no flyer.)

## Plan

1. Delete the duplicate empty "Vontastic's" flyer so the original delivered project is the only one in the list. No change to the original flyer, its pages, or its business card.
2. Remove the two remaining blank job projects (Aceroofing enterprises, Gulayan) along with their empty flyers, so nothing in Admin Jobs opens to a blank page.
3. Verify afterwards that every remaining job opens to a flyer that has content, and confirm VONTASTIC'S still loads with all three pages and its published link.

## Note before deleting

Aceroofing enterprises and Gulayan are real customer jobs that simply never had a flyer built (both still status "new"). Deleting them removes those customer requests permanently. If you'd rather keep the requests and only stop them opening blank, the alternative is to leave the jobs and detach their empty flyers so they show as "not started" instead. Tell me which you prefer — the plan above assumes full removal, as asked.

## Technical detail

- Cleanup runs as data deletes against `flyers`, `pages`, and `jobs`; the empty pages cascade with their flyer.
- No schema or RLS changes.
- Original flyer `8d5027f2…`, its three pages, its layers, and the `bizads` row are untouched.

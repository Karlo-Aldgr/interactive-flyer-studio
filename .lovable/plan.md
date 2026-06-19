## Goal
Update the novel/story chapter reader in the public viewer so navigation is clearer.

## Changes
1. **File:** `src/components/viewer/NewInteractionDialogs.tsx` (inside `NovelDialog`)
2. In the `openChapter` reading dialog, replace the single bottom-right "Back to chapters" button with a two-button layout:
   - **Left:** "Back to chapters" (moved from right)
   - **Right:** "Next chapter" (new)
3. **Next chapter behavior:**
   - Compute the next chapter index from the `chapters` array
   - If a next chapter exists and is unlocked (or free), open it directly and log a `novel_chapter_view` analytics event
   - If a next chapter exists but is locked, trigger the same PayPal unlock flow used by the chapter list (call `openPaypal('chapter', nextChapter)`)
   - Hide the button when there is no next chapter

## Technical notes
- The `isUnlocked(c, idx)` helper and `openPaypal(kind, chapter)` already exist in the component and will be reused.
- No backend or database changes are required.
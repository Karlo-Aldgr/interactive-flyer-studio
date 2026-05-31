## Problem

The published flyer has 2 pages, but no built-in UI to advance to the next page. Today, page navigation only happens via:
- A layer/page action configured in the editor (link to page)
- Tap-anywhere landing pages
- The auto-advance timer (if enabled)

If none of those are set up, viewers are stuck on page 1.

## Plan

Add lightweight prev/next navigation controls to `src/pages/PublicViewer.tsx`, shown whenever `pages.length > 1` and the current page is not a linked/landing page.

### UI
- Two circular buttons fixed to the bottom-center of the viewport (above the share/social buttons), styled like the existing share button (semi-transparent dark pill, white chevron icons, backdrop blur).
- Center page indicator: "1 / 2".
- Hide Previous on first page (or disable); hide Next on last page (unless auto-advance loop is on, then wrap).
- Hidden when `previewMode`, `isLinkedPage`, or any modal/popup/video/form is open (same guard set used by auto-advance) to avoid overlap.

### Behavior
- Prev → `setPageIndex(i => Math.max(0, i - 1))`
- Next → `setPageIndex(i => Math.min(pages.length - 1, i + 1))`
- Keyboard support: ArrowLeft / ArrowRight bound via a `useEffect` on `window` keydown, with the same open-modal guard.

### Scope
- Frontend only, single file edit (`src/pages/PublicViewer.tsx`).
- No changes to editor, store, or data model.
- Reuses `ChevronLeft` / `ChevronRight` from `lucide-react` (already imported elsewhere; add if missing).

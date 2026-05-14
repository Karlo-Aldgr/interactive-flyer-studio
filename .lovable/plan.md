## Add 1ms forward to flyer after landing page click

In `src/pages/PublicViewer.tsx`, the landing-page tap overlay (around lines 1532–1552) currently calls `setPageIndex(targetIdx)` synchronously on click.

Change the overlay's `onClick` to defer navigation by 1ms:

```ts
onClick={() => {
  window.setTimeout(() => setPageIndex(targetIdx), 1);
}}
```

This guarantees the click event fully completes before the viewer switches pages, then forwards to the linked flyer page on the next tick.

No other files change. No backend or business logic changes.

### Verification
- Open a published flyer link whose landing page has `linkPageId` set.
- Tap the landing page → flyer page should appear immediately (1ms later).
- Confirm direct flyer link (no `?page=`) still opens the flyer with no landing in between.
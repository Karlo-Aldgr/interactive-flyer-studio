## Goal
On mobile (and short desktop windows) the social-preview image in the Share dialog pushes the link input, QR, and share buttons off-screen. Make the dialog usable without zooming out.

## Changes — `src/components/editor/ShareDialog.tsx`

1. **Make the DialogContent scrollable and height-bounded**
   - Add `max-h-[90vh] overflow-y-auto` to the `<DialogContent>` of the main share dialog (line 177) so the whole dialog body scrolls when content overflows the viewport.

2. **Shrink the social-preview thumbnail**
   - On the preview wrapper (line 183), constrain its height so the image can't dominate the dialog:
     - Add `mx-auto max-h-[35vh] sm:max-h-[40vh] w-fit` to the wrapper.
   - On the `<img>` (line 188), change `block h-auto w-full` → `block h-full max-h-[35vh] sm:max-h-[40vh] w-auto object-contain` so the thumbnail scales by height, preserves aspect ratio, and never exceeds ~35–40% of the viewport.
   - On the empty-state placeholder (line 192), swap `aspect-[3/4] w-full` → a fixed compact size like `h-40 w-32` so the empty state matches the new compact preview.

3. **Tighten the QR block on small screens (small touch-up)**
   - Optional: reduce QR `size={200}` → `size={160}` so the dialog fits more of the controls above the fold on a 375px-wide phone. Keep `size={200}` if you'd rather not change QR scan quality.

## Out of scope
- No changes to the share URL logic, social buttons, worker, or Supabase.
- No layout changes to the unpublished-state dialog (already short).

## Verify
- Open share dialog at 375×812 (iPhone) — link input, Copy, QR, and Share buttons should all be reachable by scrolling within the dialog.
- Desktop preview should look essentially unchanged aside from a smaller thumbnail.

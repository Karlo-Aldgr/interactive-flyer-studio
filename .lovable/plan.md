## Problem
The page-navigation arrows I just added are hidden in the editor's Preview because the render condition includes `!previewMode`. The `/preview/:flyerId` route renders `<PublicViewer previewMode />`, so the controls never appear there.

## Fix
In `src/pages/PublicViewer.tsx`, remove `!previewMode` from the nav-controls visibility condition (keep `!isLinkedPage`, `pages.length > 1`, and the open-modal guards). Same for the keyboard handler — it already doesn't check previewMode, so no change needed there.

One-line edit, frontend only.
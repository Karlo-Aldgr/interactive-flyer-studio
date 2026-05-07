# Two text-size modes for Air messages

## Problem
Today each Air bubble has a single `fontSize` field. When the user picks a size that looks great on desktop, mobile becomes unreadable (text overflows or shrinks). The opposite happens too. We need desktop and mobile to be controlled independently.

## Approach
Treat the existing `fontSize` as the **desktop** size (user-controlled, manual). Add a separate **mobile** behavior that always auto-fits to keep text readable on small screens, ignoring the desktop manual value.

This keeps the published UX responsive while letting designers dial in the desktop look exactly as they want.

## Changes

1. **`AirBubble` (`src/components/AirBubble.tsx`)**
   - Detect viewport via `useIsMobile()`.
   - On desktop: behave as today — use `bubble.fontSize` as the manual size (upper bound for fit).
   - On mobile: ignore `bubble.fontSize` and run the auto-fit binary search from `MIN_READABLE` (14px) up to a sensible cap derived from `fitHeight` / `maxWidth`. Bubble continues to grow vertically when needed.

2. **Inspector (`src/components/editor/ActionEditor.tsx`)**
   - Relabel the existing "Font size" control to **"Desktop font size"** with helper copy: *"Mobile auto-fits for readability."*
   - No new field is required because mobile is fully automatic. (If we later want a mobile manual override we can add `fontSizeMobile` — not needed now per the request.)

3. **Types (`src/types/flyer.ts`)**
   - No schema change required. `fontSize` semantics narrow to "desktop manual size".

## Technical notes
- `useIsMobile` already exists (`src/hooks/use-mobile.tsx`, breakpoint 768px) — reuse it.
- Mobile path keeps the current `MIN_READABLE = 14` floor and the relaxed-height behavior so bubbles grow taller instead of clipping.
- No DB / backend / store changes; purely presentational.

## Out of scope
- Per-bubble mobile manual override.
- Tablet-specific tier (treated as desktop above 768px, matching existing breakpoint).

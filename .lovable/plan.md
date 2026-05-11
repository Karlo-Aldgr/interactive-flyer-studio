## Goal

Replace the bare loading spinners shown while a flyer is loading with a friendly message: **"We Are Loading Your Experience"**. Apply this in all three places that show a flyer loading state.

## Changes

### 1. Public viewer — `src/pages/PublicViewer.tsx` (~line 1229)
Replace the spinner-only loading screen with a centered spinner + message:

```tsx
<div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
  <Loader2 className="h-8 w-8 animate-spin text-primary" />
  <div className="font-display text-lg font-semibold text-foreground animate-pulse">
    We Are Loading Your Experience
  </div>
</div>
```

### 2. Editor — `src/pages/Editor.tsx` (loading branch in `Editor()`)
Replace the spinner-only screen with the same spinner + message layout, keeping the existing `bg-background` and full-height container.

### 3. Flyer Portal — `src/pages/FlyerPortal.tsx` (~line 426)
Replace the inline `<Loader2 /> Loading…` block with a centered, full-height spinner + message matching the others, so portal visitors see the same friendly text.

## Notes

- Pure presentational change — no data, routing, or analytics impact.
- Uses existing `Loader2` import and design tokens (`text-primary`, `text-foreground`, `bg-background`, `font-display`); no new dependencies.
- Message wording is exact: "We Are Loading Your Experience".

## Files touched

- `src/pages/PublicViewer.tsx`
- `src/pages/Editor.tsx`
- `src/pages/FlyerPortal.tsx`
## Social Media Slideout

Add a vertical "SOCIAL MEDIA" tab on the right edge of every flyer page (editor + public viewer). Tapping it slides out a panel with the configured social icons. The tab only appears when at least one social link is filled in. Background colors and font are editable per flyer.

### Data model (frontend only — stored in existing `flyers.settings` JSON, no migration)

Extend `FlyerSettings` in `src/types/flyer.ts`:

```ts
social?: {
  enabled?: boolean;          // auto-true when any link set
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  twitter?: string;           // X
  youtube?: string;
  linkedin?: string;
  snapchat?: string;
  threads?: string;
  website?: string;           // custom link
  // styling
  tabBgColor?: string;        // default "#1a1a1a"
  tabTextColor?: string;      // default "#ffffff"
  panelBgColor?: string;      // default "#1a1a1a"
  iconColor?: string;         // default "#ffffff"
  fontFamily?: string;        // default "Inter"
  label?: string;             // default "SOCIAL MEDIA"
}
```

### New component: `src/components/viewer/SocialSlideout.tsx`

- Fixed-positioned on the right edge of the flyer canvas container.
- Closed state: thin vertical tab (~28px wide, ~180px tall), rotated "SOCIAL MEDIA" text, rounded left edge, configurable bg/text color + font.
- Open state: animates left to reveal a panel with a column of social icons (lucide-react: `Instagram`, `Facebook`, `Youtube`, `Linkedin`, `Twitter`, `Globe`; brand-style inline SVGs for TikTok / Snapchat / Threads which lucide lacks).
- Each icon → `<a target="_blank" rel="noopener">` to the configured URL. Auto-prefixes `https://` if missing.
- Returns `null` when no links are set.
- Uses framer-motion for slide animation.

### New editor dialog: `src/components/editor/SocialMediaDialog.tsx`

- 9 URL inputs (one per platform), all optional.
- Color pickers: tab bg, tab text, panel bg, icon color.
- Font family select (reuse the font list already used elsewhere in editor).
- Label text input (default "SOCIAL MEDIA").
- Saves to `settings.social` via the existing flyer save flow in `useFlyerData` / `editorStore`.

### TopBar button

In `src/components/editor/TopBar.tsx`, add a "Social" button (Share2 icon) next to existing settings buttons that opens `SocialMediaDialog`.

### Rendering integration

- **Editor preview** — render `<SocialSlideout settings={flyer.settings.social} />` inside `src/components/editor/Canvas.tsx`, positioned relative to the page frame so it shows in the editor too (non-interactive overlay).
- **Public viewer** — render `<SocialSlideout settings={flyer.settings.social} />` in `src/pages/PublicViewer.tsx`, positioned on the right edge of the current page frame, on every flyer page (skip on landing page).

### Visibility rule

Helper `hasAnySocial(settings.social)` checks if any of the 9 URL fields is non-empty. Component early-returns `null` otherwise — so the tab simply doesn't show until the user adds at least one link.

### Files touched

- `src/types/flyer.ts` — extend `FlyerSettings`
- `src/components/viewer/SocialSlideout.tsx` — new
- `src/components/editor/SocialMediaDialog.tsx` — new
- `src/components/editor/TopBar.tsx` — add Social button
- `src/components/editor/Canvas.tsx` — render slideout overlay
- `src/pages/PublicViewer.tsx` — render slideout overlay on flyer pages

No database migration. No backend changes. Pure frontend.

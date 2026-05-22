## Per-flyer "Save to Home Screen"

Each published flyer becomes individually installable. When a visitor adds it to their home screen, the icon opens **that specific flyer** in fullscreen — not the Tap That Flyer brand site.

### How it works

A web app manifest's `start_url`, `name`, and icons are locked in at install time, so a single static manifest can't do this. We generate the manifest **dynamically per flyer** at runtime.

### Changes

1. **Generic install icon** — generate one neutral "flyer" mark (square, dark background, simple tap/flyer glyph) and save as:
   - `public/flyer-icon-192.png`
   - `public/flyer-icon-512.png`
   - `public/flyer-icon-maskable-512.png`
   - `public/apple-touch-icon.png` (180×180, used by iOS Safari)

   This icon is used for every flyer install. (Later we can swap in per-flyer thumbnails if you want — noted below.)

2. **`src/pages/PublicViewer.tsx`** — on mount, build a manifest object in memory:
   ```
   {
     name: flyer.title,
     short_name: flyer.title.slice(0, 12),
     start_url: "/v/<slug>",
     scope: "/v/<slug>",
     display: "standalone",
     background_color: page background or "#000",
     theme_color: page background or "#000",
     icons: [ /* the four generic icons above */ ]
   }
   ```
   Convert it to a `blob:` URL and inject `<link rel="manifest" href="<blob>">` into `document.head`. Also inject the apple-touch-icon link and the iOS standalone meta tags. Clean up on unmount.

3. **iOS-specific meta** added dynamically on the flyer route:
   - `apple-mobile-web-app-capable=yes`
   - `apple-mobile-web-app-status-bar-style=black-translucent`
   - `apple-mobile-web-app-title=<flyer title>`

4. **Landing/editor pages**: left alone. Only public flyer URLs are installable — that's the whole point.

### Result

- **Android / Chrome on a flyer URL** → browser shows "Install app" → home-screen icon opens *that flyer* fullscreen.
- **iOS / Safari on a flyer URL** → Share → Add to Home Screen → icon labeled with the flyer title, opens *that flyer* fullscreen.
- The Tap That Flyer brand never appears on the user's home screen — they see the flyer's name and the generic icon.

### Not included (deliberately)

- **No service worker** — keeps the Lovable preview clean and avoids stale-cache problems. Offline support is not part of this.
- **No "Install" button in the flyer UI** — relying on the browser's native prompt + iOS Share menu. Easy to add later if you want a custom prompt.

### Future option (ask if interested)

Swap the generic icon for each flyer's own thumbnail so the home-screen icon visually matches the flyer. Requires the thumbnail to be square ≥192px PNG — we'd auto-pad/crop existing thumbnails. Say the word and I'll add it.

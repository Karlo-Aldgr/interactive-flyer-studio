# Fix: business card preview is off-center vs the editor

## What I checked

I read the saved layers of this project's "Digital business card" page (canvas 1080 x 1922) and the preview renderer. Two separate things are causing the mismatch you see in photo 2.

**1. The layers really are slightly off-center on the card.**
Measured positions on the 1080-wide card:

```text
element                     x      width   left gap   right gap
top banner text            -68     1161      -68        -13   (overflows both sides)
hero image                 -13     1086      -13         -6   (overflows both sides)
GOD'S WARRIOR title         77       936       77         67
about paragraph             85       863       85        132   (visibly left-heavy)
CALL / TEXT / EMAIL row     70/390/710 x 296   70         70   (ok)
FACEBOOK / BOOK / WEBSITE   70/392/710 x 296   BOOK is 1.7px off and 4px lower than its row
SAVE CONTACT / SHARE        42 / 740           42         4
QR code                    418 x 240          center 538 (card center is 540)
```

The editor hides this because Konva draws text centered inside its box and the canvas is zoomed out; the HTML preview clips anything past the card edge, so the same layout reads as shifted.

**2. The preview scales against the wrong width.**
In `BizadLayoutView`, the scale is `wrapper.clientWidth / layout.width`, but `clientWidth` includes the wrapper's horizontal padding (`px-2`). The scaled stage therefore comes out wider than the content box and sits flush left inside it, which pushes the card a few pixels right and crops the right edge.

## What I'll change

### A. Preview renderer (fixes the global shift/crop)
- Measure the content width (subtract padding) when computing `scale`, so the stage exactly matches the visible box.
- Center the stage: wrap it in a flex/centered container and give the scaled stage an explicit `width: layout.width * scale`, so any leftover space splits evenly instead of all landing on the right.
- Keep `overflow: hidden` for deliberate full-bleed layers.

### B. Tidy this card's layout (fixes the real misalignment)
Add a one-click **"Center layout"** action in the editor for business card pages that, for the selected bizad page:
- horizontally centers every layer whose width is <= the card width (title, paragraph, name, QR, copyright);
- snaps full-bleed layers (banner text, hero image) to `x = 0, width = card width` so they bleed evenly;
- re-aligns button rows: equal side margins, equal gutters, and a single shared `y` per row (fixes BOOK sitting 4px low and 1.7px right, and the SAVE CONTACT / SHARE row's 42 vs 4 margins).

I'll also run this once on the God's Warrior card so it looks correct immediately. It stays fully editable afterwards — nothing is locked.

## Technical notes
- Files: `src/components/viewer/BizadLayoutView.tsx` (scale + centering), a new small helper in `src/lib/bizadLayoutUtils.ts` for the centering math, and the editor page/toolbar for bizad pages to expose the action.
- Only this project's own card data is touched — no cross-project data is read.
- No schema changes; the tidy writes back to the existing `layers` rows through the normal editor save path.

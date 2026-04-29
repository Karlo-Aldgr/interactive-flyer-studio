## Goal

Two additions to the FlyerFlow editor:

1. **Hotspot tool** — drag a rectangle (or circle) onto any region of the canvas to make that region clickable/linkable, just like an image-map. The hotspot is a real layer, so any existing action (URL, popup, video, form, navigate, reveal, calendar…) can be attached to it.
2. **Add to Calendar** — a new action type that generates a downloadable `.ics` event (and optional Google Calendar URL) when the hotspot/button/image is clicked in the published viewer.

## UX

### Hotspot tool
- New left-toolbar button with a dashed-square icon labeled **Hotspot**.
- Clicking it puts the canvas into "draw mode": cursor becomes crosshair, a banner at the top says *"Drag on the canvas to draw a hotspot — Esc to cancel."*
- User presses + drags on the canvas → a dashed rectangle previews while dragging → on release a new `hotspot` layer is created with that exact x/y/width/height and auto-selected, with the Inspector switched to the **Action** tab so they can immediately wire it up.
- Hotspot layer renders as: transparent fill, dashed accent-color outline in the editor (so it's visible while designing), and **fully invisible** in the published viewer — only the cursor changes to a pointer on hover.
- Shape selector in the Inspector lets the user switch a hotspot between **rectangle** and **ellipse** outline.
- Behaves like every other layer for drag, resize, rotate, delete, layer-order, undo/redo.

### Add to Calendar action
New entry in the action-type dropdown: **Add to calendar**. Inspector fields:
- Title (required)
- Description (optional, multiline)
- Location (optional)
- Start date + time (shadcn date-picker + time input)
- End date + time (or "All-day" toggle)
- Timezone (defaults to viewer's local tz)
- Behavior on click: **Download .ics** (default) and/or **Open Google Calendar in new tab**

When triggered in the public viewer it builds an RFC-5545 `.ics` blob and downloads it, and/or opens `https://calendar.google.com/calendar/render?action=TEMPLATE&...`.

## Technical changes

### Types — `src/types/flyer.ts`
- Add `"hotspot"` to `LayerType`.
- Add `"add_to_calendar"` to `ActionType`.
- Extend `ActionPayload` with: `eventTitle`, `eventDescription`, `eventLocation`, `startISO`, `endISO`, `allDay`, `timezone`, `calendarMode` (`"ics" | "google" | "both"`).
- Extend `LayerContent` with `hotspotShape?: "rect" | "ellipse"`.

### Database — migration
- Extend the `layer_type` Postgres enum: `ALTER TYPE layer_type ADD VALUE 'hotspot';`
- Extend the `action_type` enum: `ALTER TYPE action_type ADD VALUE 'add_to_calendar';`
- (Existing RLS already covers any layer/action belonging to the owner — no policy changes.)

### Editor store — `src/store/editorStore.ts`
- Add `drawMode: null | "hotspot"` plus `setDrawMode(mode)`.
- Add `addHotspotLayer(rect: {x,y,width,height})` that pushes a `hotspot` layer with transparent fill + dashed stroke style and auto-selects it.
- Hook into history same as other layer adds.

### Toolbar — `src/components/editor/Toolbar.tsx`
- New `Hotspot` button (lucide `SquareDashed` icon) → `setDrawMode("hotspot")`.
- Active state styling when `drawMode === "hotspot"`.

### Canvas — `src/components/editor/Canvas.tsx`
- When `drawMode === "hotspot"`:
  - Disable layer selection on stage mousedown.
  - Track `dragStart` + `dragCurrent` in local state.
  - Render a temporary dashed `Rect` while dragging.
  - On mouseup: if rect ≥ 8×8 px, call `addHotspotLayer` with normalized coords (handles negative drags), then exit draw mode.
- Esc key cancels draw mode.
- Cursor switches to `crosshair` while in draw mode.
- Add a top banner inside the canvas area with the instruction + Cancel button.

### LayerRenderer — `src/components/editor/LayerRenderer.tsx`
- New `case "hotspot"`: renders a `Rect` (or ellipse via `Ellipse` from react-konva) with `fill="rgba(124,58,237,0.08)"`, dashed stroke `[6,4]`, accent stroke color. Always selectable/draggable; in the editor it remains visible.

### Inspector — `src/components/editor/Inspector.tsx`
- For `hotspot` layers: hide style controls except opacity + a "Shape" toggle (rect/ellipse). Default tab = **Action**.

### ActionEditor — `src/components/editor/ActionEditor.tsx`
- Add `add_to_calendar` to `ACTION_LABELS`.
- New form section with the fields above. Use shadcn date-picker pattern (already documented in the codebase) plus a native `<input type="time">` and an All-day `<Switch>`. Behavior radio: ICS / Google / Both.
- Persist into `payload` (matches the new `ActionPayload` keys).

### Helpers — new `src/lib/calendarHelpers.ts`
- `buildIcs(payload)` — returns an RFC-5545 string.
- `buildGoogleCalendarUrl(payload)` — returns the `calendar.google.com/render?…` URL with proper `dates=YYYYMMDDTHHMMSSZ/…` formatting.
- `triggerDownload(filename, text, mime)` helper.

### Public Viewer — `src/pages/PublicViewer.tsx`
PublicViewer is currently just a placeholder. To actually make hotspots clickable for end users, this plan also wires up the bare-minimum runtime: render the published flyer's pages/layers (Konva, read-only), apply a pointer cursor on layers that have an action, and on click dispatch through a small `runAction()` switch that handles all existing action types **plus** `add_to_calendar`. Hotspots render with **no visible fill or stroke** in the public view — only the pointer cursor signals interactivity. Analytics events fire on click as before.

> If you'd prefer to defer the public-viewer wiring to a separate task and only build the editor-side authoring of hotspots + calendar action now, say so and I'll trim that part.

## Out of scope
- Polygon / freeform hotspots (only rect + ellipse for v1).
- Recurring calendar events (RRULE).
- Outlook/Yahoo calendar links (ICS download already covers Outlook/Apple).

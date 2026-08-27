# Make button links editable inline

Today every button's destination lives in the Inspector's **Action** tab (ActionEditor), which requires picking an action type and saving. On business-card pages the template auto-generates tiles like WEBSITE, FACEBOOK, EMAIL, BOOK — and a social tile with no link is created as a "Setup Required" placeholder with no editable URL surfaced.

## What changes

1. **Quick Link field on the Style tab**
   For any selected button (or image/shape) layer, show a "Link / destination" input directly under the label field:
   - If the action is `open_url` → edits the URL (auto-prefixes `https://`, keeps `mailto:`/`tel:`/`sms:` intact).
   - If the action is `call`/`sms` → edits the phone number.
   - If the action is `map` → edits the address.
   - If there is no action yet (including the "Setup Required" placeholders) → typing a URL creates an `open_url` action opening in a new tab.
   Full advanced editing stays in the Action tab; this is just a shortcut for the common case.

2. **Setup Required cleanup**
   When a link is entered on a tile whose label ends in "Setup Required", the label is trimmed back to the clean name (e.g. `FACEBOOK\nSetup Required` → `FACEBOOK`).

3. **Multi-select untouched**
   The quick link field only shows for a single selected layer.

## Note on regeneration

Editing a link here changes the flyer page layer, not the saved business card record. If the card is later regenerated from the Business Card dialog, template-generated tiles are rebuilt from the card's fields. The plan keeps that behavior; to make a link permanent for regeneration, it should also be set in the Business Card dialog fields.

## Technical

- `src/components/editor/Inspector.tsx`: new `QuickLinkField` block in the Style tab, reading `layer.action`, writing via existing `setLayerAction` / `updateLayerContent`.
- Reuse `normalizeUrl` from `src/lib/bizadTemplates/kit.ts` for URL prefixing.
- No schema, store, or template changes.

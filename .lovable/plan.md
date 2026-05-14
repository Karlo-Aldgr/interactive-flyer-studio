I’ll make the share link carry both pieces of intent:

1. **Keep Facebook preview behavior unchanged**
   - The URL will still include `?page=<landingPageId>` so Facebook/Meta crawlers keep using the landing-page preview image and metadata.

2. **Add an explicit human-click bypass target**
   - When a landing page has `background.linkPageId`, the generated landing share URL will also include the linked flyer page id, for example:
     `?page=<landingPageId>&open=<flyerPageId>`
   - This makes the bypass reliable even if the public viewer cannot infer the link quickly enough from the landing page.

3. **Update `PublicViewer` initial page selection**
   - On load, if `open=<pageId>` is present and matches a real page, open that flyer page immediately.
   - Otherwise, keep the existing behavior: if `?page=` points to a landing page with `linkPageId`, jump to its linked page; if no query exists, skip any configured landing page.

4. **Verification**
   - Confirm the generated landing share URL includes both `page` and `open`.
   - Confirm the viewer’s initial page-selection logic prioritizes `open` while preserving existing fallback behavior.
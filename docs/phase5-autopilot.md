# Phase 5 MVP: AutoPilot Marketing shell

Shipped: client-style **checkboxes + START** dashboard wired to channels we already have. Not a full SaaS / agency platform yet.

## Client goal (basis)

Sherman Bowen Option 2 vision: flyer → AI content → schedule → track → improve, with one **Tap That Flyer AI** panel and a **START** button.

## What shipped

| Piece | Location |
|-------|----------|
| AutoPilot dialog | `src/components/editor/AutoPilotDialog.tsx` |
| Hub entry | Automation Hub → **Open AutoPilot** |
| Portal strip | `AutoPilotPortalStrip` on flyer portal (status + link to editor) |
| AI Chatbot (MVP) | `FlyerChatbot` on published `/f/…` + `flyer-chat` edge function |

### START (current)

| Checked | Behavior |
|---------|----------|
| Facebook / Instagram / Email / TikTok / SMS / Google Ads | Regenerates AI marketing draft, opens AI Social Copy |
| AI Analytics | Toast + link to portal Suggestions |
| AI QR Code | Opens Share dialog (QR for this flyer) |
| AI Chatbot | Opens published flyer; **Ask AI** button (bottom-left) |
| AutoPilot Marketing (everything) | Selects all live options |

### AI Chatbot MVP (v1 → v1.1 context)

- Public Q&A on published flyers (`flyer-chat` + **Ask AI** widget).
- **v1.1:** Answers use page/layer text + action links/menus/products from the flyer (not title-only).
- Not a full CRM / support desk; does not invent prices or policies missing from flyer content.
- Requires published flyer + `OPENAI_API_KEY` on the edge function.

**Deploy:** Redeploy `flyer-chat` in Lovable (or Supabase). `verify_jwt = false` so anonymous visitors can chat. No SQL migration.

## How to verify

1. Published flyer → **Add automations** → **Open AutoPilot**
2. Toggle **AutoPilot Marketing (everything)** → all live boxes check (including Chatbot)
3. Check **AI Chatbot** alone → START → public flyer opens → **Ask AI**
4. Ask a short question; expect a brief reply
5. Do **not** publish the live website

## Deferred

- Richer chatbot: lead handoff to business inbox / CRM
- Real channel send APIs beyond Meta (TikTok/SMS/Google Ads post APIs)
- Phase 5+: subscriptions, agency white-label, unattended full AutoPilot

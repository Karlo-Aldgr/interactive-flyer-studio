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

### START (current)

| Checked | Behavior |
|---------|----------|
| Facebook / Instagram / Email / TikTok / SMS / Google Ads | Regenerates AI marketing draft, opens AI Social Copy |
| AI Analytics | Toast + link to portal Suggestions |
| AI QR Code | Opens Share dialog (QR for this flyer) |
| AutoPilot Marketing (everything) | Selects all live options |
| AI Chatbot | **Coming soon** |

## How to verify

1. Published flyer → **Add automations** → **Open AutoPilot**
2. Toggle **AutoPilot Marketing (everything)** → all live boxes check
3. Check **AI QR Code** alone → START → Share opens
4. Do **not** publish the live website

## Deferred

- Real channel send APIs beyond Meta
- Phase 5+: subscriptions, agency white-label, chatbot, unattended full AutoPilot

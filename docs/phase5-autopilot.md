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

### START (v1)

| Checked | Behavior |
|---------|----------|
| Facebook / Instagram / Email | Regenerates AI marketing draft, opens AI Social Copy |
| AI Analytics | Toast + link to portal Suggestions |
| TikTok, Google Ads, SMS, Chatbot, QR, AutoPilot-everything | Visible, **Coming soon** |

## How to verify

1. Published flyer → **Add automations** → **Open AutoPilot**
2. Leave FB + IG + Email checked → **START**
3. Confirm regenerate + AI Social Copy opens with copy
4. Portal shows AutoPilot strip (FB/IG/email badges)
5. Do **not** publish the live website

## Deferred

- Phase 4 leftovers: TikTok, SMS, Google Ads, MassEmail send
- Phase 5+: subscriptions, agency white-label, chatbot, unattended full AutoPilot

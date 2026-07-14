# AI Marketing Coach MVP

PDF roadmap item #1: score a flyer before (or after) promoting it.

## What shipped

| Piece | Location |
|-------|----------|
| Edge function | `supabase/functions/flyer-coach` (`verify_jwt = true`) |
| Dialog | `src/components/editor/MarketingCoachDialog.tsx` |
| Hub entry | Automations → **AI Marketing Coach** |

## Scores (0–10 each + overall /100)

- Headline strength
- Call to action
- Readability
- Color / contrast *(notes when pixel contrast can’t be measured)*
- Audience targeting
- Conversion likelihood

Plus a short summary and up to 5 actionable recommendations.

## Deploy

1. Merge PR
2. Redeploy **`flyer-coach`** in Lovable (uses `OPENAI_API_KEY`)
3. No SQL
4. Do **not** publish the live website

## Verify

1. Editor → **Add automations** → **Open coach**
2. Wait for overall score + dimension tips
3. **Re-run coach** works
4. Image-heavy flyer: coach should mention sparse text layers / coach on hotspots

## Out of scope (later)

- Persist scores / history
- Auto-rewrite from coach tips
- True pixel contrast / OCR of design images

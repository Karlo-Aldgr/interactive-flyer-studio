# Fix AI marketing generate (skip broken n8n callback)

TapThatFlyer can now generate Facebook + Instagram copy **directly with OpenAI**
inside `marketing-trigger` (no n8n callback needed).

## 1. Add secret in Lovable

Lovable → Cloud / Supabase secrets → add:

| Secret | Value |
|--------|--------|
| `OPENAI_API_KEY` | your OpenAI API key (same one used in n8n) |

Optional:

| Secret | Value |
|--------|--------|
| `OPENAI_MARKETING_MODEL` | `gpt-4o-mini` (default) |

## 2. Deploy edge function

Ask Lovable:

```text
Please deploy/redeploy marketing-trigger from main.
Do NOT publish the website.
Confirm OPENAI_API_KEY secret exists.
```

## 3. Test

1. Hard refresh editor
2. Add automations → Open AI posts → Regenerate
3. Within a few seconds status should become **Ready** with real copy

n8n remains optional fallback only if `OPENAI_API_KEY` is missing.

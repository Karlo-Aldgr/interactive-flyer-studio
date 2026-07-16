# Chatbot lead gate + portal knowledge

Client request: Ask AI introduces itself as an **information assistant**, collects **name + email** before answers, and can use owner-written portal facts.

## What shipped

- Lead form before chat (`FlyerChatbot`) — saves to `subscribers` with `source = chatbot`, list `AI Chatbot`
- `flyer-chat` requires `visitor_name` + `visitor_email`; role = information assistant
- Portal card **Ask AI knowledge** (`flyers.chatbot_knowledge`) — owner notes for business/event details
- Migration: `20260715200000_flyer_chatbot_knowledge.sql`

## Deploy

1. Merge PR
2. Run SQL migration in Lovable
3. Redeploy **`flyer-chat`**
4. Do **not** publish website unless asked

## Verify

1. Published flyer → Ask AI → must enter name/email → then questions work
2. Lead appears under portal Subscribers (`AI Chatbot`)
3. Portal → Ask AI knowledge → save notes → ask about those facts in chat

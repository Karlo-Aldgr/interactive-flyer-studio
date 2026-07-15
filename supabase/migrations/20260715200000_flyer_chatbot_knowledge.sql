-- Extra owner-written facts for the public flyer Ask AI chatbot.
ALTER TABLE public.flyers
  ADD COLUMN IF NOT EXISTS chatbot_knowledge text;

COMMENT ON COLUMN public.flyers.chatbot_knowledge IS
  'Optional business/event facts for Ask AI (portal). Max practical length enforced in app.';

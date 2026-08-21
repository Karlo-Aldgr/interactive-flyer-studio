CREATE OR REPLACE FUNCTION public.flyers_create_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.flyer_id = NEW.id) THEN
    INSERT INTO public.jobs (user_id, customer_email, type, title, status, flyer_id, selected_actions)
    VALUES (
      NEW.owner_id,
      (SELECT p.email FROM public.profiles p WHERE p.id = NEW.owner_id),
      'design',
      NEW.title,
      CASE WHEN NEW.status = 'published' THEN 'delivered'::job_status ELSE 'new'::job_status END,
      NEW.id,
      '[]'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS flyers_create_job_trg ON public.flyers;
CREATE TRIGGER flyers_create_job_trg
AFTER INSERT ON public.flyers
FOR EACH ROW EXECUTE FUNCTION public.flyers_create_job();
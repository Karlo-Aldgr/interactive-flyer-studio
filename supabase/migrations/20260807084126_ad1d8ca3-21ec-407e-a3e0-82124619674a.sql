CREATE TABLE public.automation_script_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flyer_id uuid NOT NULL REFERENCES public.flyers(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'requested',
  custom_request text,
  priority text NOT NULL DEFAULT 'normal',
  due_date date,
  facebook_post text,
  instagram_caption text,
  tiktok_caption text,
  email_subject text,
  email_body text,
  sms_body text,
  staff_notes text,
  fulfilled_by uuid,
  fulfilled_at timestamptz,
  sheet_row integer,
  sheet_synced_at timestamptz,
  sheet_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_script_requests TO authenticated;
GRANT ALL ON public.automation_script_requests TO service_role;

ALTER TABLE public.automation_script_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their automation script requests"
ON public.automation_script_requests FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Staff manage all automation script requests"
ON public.automation_script_requests FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE INDEX idx_automation_script_requests_flyer ON public.automation_script_requests(flyer_id);
CREATE INDEX idx_automation_script_requests_owner ON public.automation_script_requests(owner_id);

CREATE TRIGGER automation_script_requests_set_updated_at
BEFORE UPDATE ON public.automation_script_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
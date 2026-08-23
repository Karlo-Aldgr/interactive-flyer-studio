ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_flyer_id_fkey
  FOREIGN KEY (flyer_id) REFERENCES public.flyers(id) ON DELETE SET NULL;
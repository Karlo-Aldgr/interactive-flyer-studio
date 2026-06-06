
CREATE POLICY "Admins manage example thumbnails read" ON storage.objects FOR SELECT USING (bucket_id = 'flyer-thumbnails' AND (storage.foldername(name))[1] = 'examples');
CREATE POLICY "Admins manage example thumbnails insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'flyer-thumbnails' AND (storage.foldername(name))[1] = 'examples' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage example thumbnails update" ON storage.objects FOR UPDATE USING (bucket_id = 'flyer-thumbnails' AND (storage.foldername(name))[1] = 'examples' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage example thumbnails delete" ON storage.objects FOR DELETE USING (bucket_id = 'flyer-thumbnails' AND (storage.foldername(name))[1] = 'examples' AND public.has_role(auth.uid(), 'admin'));

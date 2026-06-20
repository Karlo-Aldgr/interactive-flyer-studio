import { supabase } from "@/integrations/supabase/client";

/**
 * The `jobs.upload_url` column historically stored a full public URL. The
 * job-uploads bucket is now private, so we always resolve to a short-lived
 * signed URL. Accepts either a storage path or a legacy full URL.
 */
export function jobUploadPath(stored: string): string {
  if (!stored) return stored;
  const marker = "/job-uploads/";
  const idx = stored.indexOf(marker);
  if (idx >= 0) return stored.slice(idx + marker.length);
  return stored;
}

export async function getJobUploadSignedUrl(stored: string, expiresInSec = 300): Promise<string | null> {
  const path = jobUploadPath(stored);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from("job-uploads")
    .createSignedUrl(path, expiresInSec);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function jobUploadFilename(stored: string): string {
  const path = jobUploadPath(stored);
  return path.split("/").pop() || path;
}

export async function downloadJobUpload(stored: string): Promise<boolean> {
  const url = await getJobUploadSignedUrl(stored, 300);
  if (!url) return false;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = jobUploadFilename(stored);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return true;
  } catch {
    return false;
  }
}

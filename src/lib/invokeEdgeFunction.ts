import { supabase } from "@/integrations/supabase/client";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";

/** Invoke a Supabase edge function and surface JSON error bodies (not just "non-2xx"). */
export async function invokeEdgeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const base = import.meta.env.VITE_SUPABASE_URL as string;

  const res = await fetch(`${base}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? anon}`,
      apikey: anon,
    },
    body: JSON.stringify(body),
  });

  let data: { error?: string } & T = {} as { error?: string } & T;
  try {
    data = await res.json();
  } catch {
    data = {} as { error?: string } & T;
  }

  if (!res.ok) {
    throw new Error(
      edgeFunctionErrorMessage(
        { message: `HTTP ${res.status}` },
        data,
        `Edge function failed (${res.status})`,
      ),
    );
  }
  if (data?.error) {
    throw new Error(edgeFunctionErrorMessage(null, data, data.error));
  }
  return data;
}

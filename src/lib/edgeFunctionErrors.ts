/** Pull a useful message from Supabase edge function invoke failures. */
export function edgeFunctionErrorMessage(
  error: { message?: string } | null,
  data?: { error?: string } | null,
  fallback = "Request failed",
): string {
  const msg = data?.error || error?.message || "";
  if (/failed to send a request to the edge function/i.test(msg)) {
    return "Edge function is not deployed on this Supabase project — deploy portal-access, smart-detect, and subject-detect in Lovable Cloud → Edge functions.";
  }
  if (msg.includes("LOVABLE_API_KEY")) {
    return "AI is not configured on this Supabase project (missing LOVABLE_API_KEY secret).";
  }
  if (msg.includes("non-2xx")) {
    return "Edge function failed — check Supabase function logs and LOVABLE_API_KEY secret.";
  }
  if (/AI request failed/i.test(msg)) {
    return "AI gateway rejected the request — use Rectangle select for now, or deploy subject-detect on TapThatFlyer with a valid LOVABLE_API_KEY.";
  }
  return msg || fallback;
}

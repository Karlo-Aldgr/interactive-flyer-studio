import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * TikTok Login Kit redirect target — the static HTTPS callback registered in the
 * TikTok Developer Portal (https://tapthatflyer.com/auth/tiktok/callback).
 *
 * The authorization code is never exchanged in the browser: it is forwarded to
 * the social-oauth-callback edge function, which validates the single-use state,
 * exchanges the code server-side with the TikTok client secret and stores the
 * encrypted tokens against the signed-in TapThatFlyer account.
 */
export default function TikTokCallback() {
  const navigate = useNavigate();
  const ran = useRef(false);
  const [message, setMessage] = useState("Finishing your TikTok connection…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") ?? "";
    const state = params.get("state") ?? "";
    const rawError = params.get("error") ?? "";
    const errorDescription = params.get("error_description") ?? "";
    const cancelled = /access_denied|cancel/i.test(`${rawError} ${errorDescription}`);

    (async () => {
      if (cancelled) {
        setMessage("TikTok connection cancelled.");
        setTimeout(
          () =>
            navigate(
              `/dashboard/social?social_error=${encodeURIComponent("TikTok connection cancelled.")}`,
              { replace: true },
            ),
          600,
        );
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke("social-oauth-callback", {
        body: { code, state, error: rawError, error_description: errorDescription },
      });
      const target = (data?.redirect_path as string) || "/dashboard/social";
      const next = new URLSearchParams();
      if (fnError || !data?.ok) {
        next.set(
          "social_error",
          (data?.error as string) ||
            "We couldn't finish connecting TikTok. Please try again.",
        );
        setMessage("That didn't work — taking you back…");
      } else {
        next.set("social_connected", "tiktok");
        next.set("social_accounts", String(data.accounts ?? 1));
        setMessage("TikTok connected! Taking you back…");
      }
      setTimeout(() => navigate(`${target}?${next.toString()}`, { replace: true }), 600);
    })();
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground">Connecting TikTok</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

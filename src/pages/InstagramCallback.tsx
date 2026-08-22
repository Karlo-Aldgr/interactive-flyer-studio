import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Instagram Business Login redirect target.
 *
 * Meta redirects the customer here with ?code=&state=. The code itself is never
 * exchanged in the browser — it is forwarded to the backend, which performs the
 * secure server-side exchange and stores the encrypted Instagram token against
 * the signed-in TapThatFlyer account.
 */
export default function InstagramCallback() {
  const navigate = useNavigate();
  const ran = useRef(false);
  const [message, setMessage] = useState("Finishing your Instagram connection…");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") ?? "";
    const state = params.get("state") ?? "";
    const error = params.get("error_description") || params.get("error");

    (async () => {
      const { data, error: fnError } = await supabase.functions.invoke("social-oauth-callback", {
        body: { code, state, error },
      });
      const target = (data?.redirect_path as string) || "/dashboard/social";
      const next = new URLSearchParams();
      if (fnError || !data?.ok) {
        next.set("social_error", (data?.error as string) || "We couldn't finish connecting Instagram. Please try again.");
        setMessage("That didn't work — taking you back…");
      } else {
        next.set("social_connected", "instagram");
        next.set("social_accounts", String(data.accounts ?? 1));
        setMessage("Instagram connected! Taking you back…");
      }
      setTimeout(() => navigate(`${target}?${next.toString()}`, { replace: true }), 600);
    })();
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground">Connecting Instagram</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </main>
  );
}

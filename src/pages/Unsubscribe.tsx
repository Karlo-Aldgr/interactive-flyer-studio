import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, MailX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!token) {
        setState("error");
        setMessage("This unsubscribe link is missing its code.");
        return;
      }
      if (token === "preview") {
        setState("done");
        setMessage("This is a preview link — no changes were made.");
        return;
      }
      const { data, error } = await supabase.functions.invoke("marketing-subscribe", {
        body: { action: "unsubscribe", token },
      });
      if (cancelled) return;
      if (error || (data as any)?.error) {
        setState("error");
        setMessage((data as any)?.error || "We could not process that unsubscribe link.");
        return;
      }
      setState("done");
      setMessage("You have been unsubscribed and will no longer receive these emails.");
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md space-y-4 p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {state === "loading" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <MailX className="h-6 w-6" />
          )}
        </div>
        <h1 className="text-2xl font-bold">
          {state === "loading" ? "Processing…" : state === "done" ? "Unsubscribed" : "Link problem"}
        </h1>
        <p className="text-muted-foreground">{message}</p>
        <Button asChild variant="outline">
          <Link to="/">Back to TapThatFlyer</Link>
        </Button>
      </Card>
    </main>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Loader2, RefreshCcw, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";

interface Props {
  flyerId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function PortalLinkDialog({ flyerId, open, onOpenChange }: Props) {
  const [token, setToken] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      // Ensure a credentials row exists (auto-created by trigger for new flyers,
      // but be defensive for older ones).
      let { data, error } = await supabase
        .from("flyer_portal_credentials" as any)
        .select("portal_token, portal_access_code")
        .eq("flyer_id", flyerId)
        .maybeSingle();
      if (!data && !error) {
        const inserted = await supabase
          .from("flyer_portal_credentials" as any)
          .insert({ flyer_id: flyerId })
          .select("portal_token, portal_access_code")
          .maybeSingle();
        data = inserted.data as any;
        error = inserted.error as any;
      }
      if (error) toast.error(error.message);
      else if (data) {
        setToken((data as any).portal_token);
        setCode((data as any).portal_access_code);
      }
      setLoading(false);
    })();
  }, [open, flyerId]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = token ? `${origin}/p/${token}` : "";
  const urlWithCode = token && code ? `${url}?code=${encodeURIComponent(code)}` : "";

  async function regenerate(field: "token" | "code" | "both") {
    setBusy(true);
    const update: any = {};
    if (field === "token" || field === "both") update.portal_token = crypto.randomUUID();
    if (field === "code" || field === "both") {
      update.portal_access_code = Array.from({ length: 6 }, () =>
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]
      ).join("");
    }
    const { data, error } = await supabase
      .from("flyer_portal_credentials" as any)
      .update(update)
      .eq("flyer_id", flyerId)
      .select("portal_token, portal_access_code")
      .maybeSingle();
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data) {
      setToken((data as any).portal_token);
      setCode((data as any).portal_access_code);
      toast.success("Updated. Old link no longer works.");
    }
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Private portal link</DialogTitle>
          <DialogDescription>
            Share this link and access code with anyone who needs to see this flyer's analytics, subscribers, appointments, polls, and purchases.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Portal link</Label>
              <div className="flex gap-1">
                <Input readOnly value={url} />
                <Button size="icon" variant="outline" onClick={() => copy(url, "Link")}><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" disabled={busy} onClick={() => regenerate("token")} title="Generate a new link">
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Access code</Label>
              <div className="flex gap-1">
                <Input readOnly value={code} className="font-mono tracking-widest" />
                <Button size="icon" variant="outline" onClick={() => copy(code, "Code")}><Copy className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" disabled={busy} onClick={() => regenerate("code")} title="Generate a new code">
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="rounded border border-dashed border-border p-3">
              <Label className="text-xs">One-click link (link + code combined)</Label>
              <div className="mt-1 flex gap-1">
                <Input readOnly value={urlWithCode} className="text-xs" />
                <Button size="icon" variant="outline" onClick={() => copy(urlWithCode, "One-click link")}><Copy className="h-4 w-4" /></Button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Anyone with this URL can view the portal without typing the code.</p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => regenerate("both")}>
            <RefreshCcw className="mr-1 h-4 w-4" /> Reset link & code
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

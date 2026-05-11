import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";
import { FlyerPortalView } from "@/components/portal/FlyerPortalView";

interface PortalData {
  flyer: { id: string; title: string; status: string; public_slug: string | null; thumbnail_url: string | null; created_at: string };
  subscribers: any[];
  appointments: any[];
  submissions: any[];
  pollVotes: any[];
  events: any[];
  actions: any[];
  layers: any[];
}

export default function PublicFlyerPortal() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unlock(c: string) {
    if (!token || !c.trim()) return;
    setLoading(true); setError(null);
    const { data: res, error: err } = await supabase.functions.invoke("portal-access", {
      body: { token, code: c.trim() },
    });
    setLoading(false);
    if (err || (res as any)?.error) {
      setError((res as any)?.error || err?.message || "Could not load portal");
      return;
    }
    setData(res as PortalData);
  }

  useEffect(() => {
    const c = params.get("code");
    if (c && !data) void unlock(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Flyer portal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter the access code for this flyer's portal.</p>
            <div className="space-y-1">
              <Label htmlFor="code">Access code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && unlock(code)}
                placeholder="ABC123"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" onClick={() => unlock(code)} disabled={loading || !code.trim()}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Unlock
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <FlyerPortalView
      flyer={data.flyer}
      events={data.events || []}
      subscribers={data.subscribers || []}
      appointments={data.appointments || []}
      submissions={data.submissions || []}
      pollVotes={data.pollVotes || []}
      actions={data.actions || []}
      layers={data.layers || []}
      mode="public"
      onRefresh={() => unlock(code)}
    />
  );
}

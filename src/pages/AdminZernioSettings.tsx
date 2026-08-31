import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, PlugZap, ShieldCheck, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  fetchZernioAdminStatus,
  removeZernioApiKey,
  saveZernioApiKey,
  testZernioConnection,
} from "@/lib/zernioAdmin";

function formatWhen(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

export default function AdminZernioSettings() {
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "test" | "remove">(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const status = useQuery({
    queryKey: ["zernio-admin-status"],
    queryFn: fetchZernioAdminStatus,
    enabled: isAdmin,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!showKey) return;
    const t = setTimeout(() => setShowKey(false), 15_000);
    return () => clearTimeout(t);
  }, [showKey]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["zernio-admin-status"] });

  const run = async (kind: "save" | "test" | "remove") => {
    setBusy(kind);
    setResult(null);
    try {
      if (kind === "save") {
        await saveZernioApiKey(apiKey);
        setApiKey("");
        setShowKey(false);
        toast({ title: "API key saved", description: "The key is stored securely on the server." });
      } else if (kind === "remove") {
        await removeZernioApiKey();
        toast({ title: "API key removed" });
      } else {
        const res = await testZernioConnection();
        setResult({ ok: res.ok, message: res.message });
        toast({
          title: res.ok ? "Connected successfully" : "Connection failed",
          description: res.message,
          variant: res.ok ? undefined : "destructive",
        });
      }
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setResult({ ok: false, message });
      toast({ title: "Request failed", description: message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (roleLoading) {
    return (
      <AdminLayout>
        <Skeleton className="h-40 w-full" />
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout>
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            You need administrator access to view the Zernio integration settings.
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  const data = status.data;
  const envManaged = data?.source === "environment";

  return (
    <AdminLayout active="social-accounts">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Zernio Integration</h1>
          <p className="text-sm text-muted-foreground">
            The API key is stored server-side only. It is never sent back to this page.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <PlugZap className="h-4 w-4" /> Connection status
            </CardTitle>
            {status.isLoading ? (
              <Skeleton className="h-6 w-28" />
            ) : (
              <Badge variant={data?.configured ? "default" : "secondary"}>
                {data?.configured ? "Configured" : "Not configured"}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Key: <span className="font-mono">{data?.key_hint ?? "—"}</span>
              {envManaged && " (from the environment secret)"}
            </p>
            <p>Last saved: {formatWhen(data?.updated_at ?? null)}</p>
            <p>Last tested: {formatWhen(data?.last_tested_at ?? null)}</p>
            {data?.last_test_message && (
              <p className={data.last_test_ok ? "text-foreground" : "text-destructive"}>
                {data.last_test_message}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> API key
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="zernio-api-key">Zernio API key</Label>
              <div className="flex gap-2">
                <Input
                  id="zernio-api-key"
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  placeholder="Paste the Zernio business API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Saving replaces any previously stored key. The value is write-only.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => run("save")} disabled={busy !== null || apiKey.trim().length < 8}>
                {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save API key
              </Button>
              <Button
                variant="outline"
                onClick={() => run("test")}
                disabled={busy !== null || !data?.configured}
              >
                {busy === "test" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Test connection
              </Button>
              <Button
                variant="destructive"
                onClick={() => run("remove")}
                disabled={busy !== null || envManaged || !data?.configured}
              >
                {busy === "remove" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Remove API key
              </Button>
            </div>

            {envManaged && (
              <p className="text-xs text-muted-foreground">
                The key currently comes from the environment secret, so it cannot be removed here.
              </p>
            )}

            {result && (
              <p className={result.ok ? "text-sm text-foreground" : "text-sm text-destructive"}>
                {result.message}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

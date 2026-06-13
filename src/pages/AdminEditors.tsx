import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2, UserPlus } from "lucide-react";
import logo from "@/assets/logo.png";

type Editor = { user_id: string; email: string; granted_at: string };

export default function AdminEditors() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => {
        const ok = !!data;
        setIsAdmin(ok);
        if (!ok) navigate("/dashboard");
      });
  }, [user, navigate]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("list_editors" as any);
    if (error) toast.error(error.message);
    else setEditors((data ?? []) as Editor[]);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const grant = async () => {
    if (!email.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("grant_editor_by_email" as any, { _email: email.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) return toast.error(res?.error ?? "Failed");
    toast.success("Editor access granted");
    setEmail("");
    load();
  };

  const revoke = async (em: string) => {
    if (!confirm(`Revoke editor access for ${em}?`)) return;
    const { data, error } = await supabase.rpc("revoke_editor_by_email" as any, { _email: em });
    if (error) return toast.error(error.message);
    const res = data as { ok: boolean; error?: string };
    if (!res?.ok) return toast.error(res?.error ?? "Failed");
    toast.success("Revoked");
    load();
  };

  if (isAdmin === null) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="TapThatFlyer" className="h-9 w-auto" />
          </Link>
          <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" />Dashboard</Link></Button>
        </div>
      </header>

      <main className="container max-w-3xl py-10">
        <h1 className="font-display text-3xl font-bold">Editor access</h1>
        <p className="mt-1 text-muted-foreground">
          New customers sign up to submit a job and don't get editor access by default.
          Grant editor access here by email after you've reviewed their order.
        </p>

        <Card className="mt-8 p-6">
          <Label htmlFor="email">Grant editor access by email</Label>
          <div className="mt-2 flex gap-2">
            <Input
              id="email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && grant()}
            />
            <Button onClick={grant} disabled={busy || !email.trim()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Grant
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">The email must belong to an account that has already signed up.</p>
        </Card>

        <h2 className="mt-10 font-display text-xl font-semibold">Editors ({editors.length})</h2>
        <div className="mt-4 space-y-2">
          {loading ? (
            <div className="flex h-20 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : editors.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">No editors yet.</Card>
          ) : (
            editors.map((e) => (
              <Card key={e.user_id} className="flex items-center justify-between p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{e.email}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => revoke(e.email)} className="text-destructive hover:text-destructive">
                  <Trash2 className="mr-1 h-4 w-4" />Revoke
                </Button>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

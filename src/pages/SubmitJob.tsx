import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Upload, Wand2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { INTERACTIONS } from "@/lib/interactionsCatalog";
import logo from "@/assets/logo.png";

export default function SubmitJob() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialType = (params.get("type") === "design" ? "design" : "upload") as "upload" | "design";
  const [type, setType] = useState<"upload" | "design">(initialType);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setType(initialType); }, [initialType]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = async () => {
    if (!user) return;
    if (!title.trim()) { toast.error("Please add a title for your job."); return; }
    if (type === "upload" && !file) { toast.error("Please upload your flyer file."); return; }
    if (type === "design" && !brief.trim()) { toast.error("Please share a short brief."); return; }
    if (selected.length === 0) { toast.error("Pick at least one interaction."); return; }

    setSubmitting(true);
    try {
      let uploadUrl: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("job-uploads").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        // Store the storage path; the bucket is private, viewers fetch a signed URL on demand.
        uploadUrl = path;
      }

      const { error } = await supabase.from("jobs").insert({
        user_id: user.id,
        customer_email: user.email ?? null,
        type,
        title: title.trim(),
        brief: brief.trim() || null,
        upload_url: uploadUrl,
        selected_actions: selected,
        status: "new",
      });
      if (error) throw error;
      toast.success("Job submitted! We'll review and send you a quote.");
      navigate("/my-jobs");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="TapThatFlyer logo" className="h-9 w-auto" />
          </Link>
          <Button asChild variant="ghost" size="sm"><Link to="/my-jobs"><ArrowLeft className="mr-1 h-4 w-4" />My jobs</Link></Button>
        </div>
      </header>

      <main className="container max-w-3xl py-10">
        <h1 className="font-display text-3xl font-bold md:text-4xl">Submit a job</h1>
        <p className="mt-2 text-muted-foreground">Tell us what you need. We'll review, send a price and a payment link.</p>

        <div className="mt-8 space-y-8">
          <Tabs value={type} onValueChange={(v) => setType(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload"><Upload className="mr-2 h-4 w-4" />I have a flyer</TabsTrigger>
              <TabsTrigger value="design"><Wand2 className="mr-2 h-4 w-4" />Design one for me</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4 pt-6">
              <div>
                <Label htmlFor="file">Upload flyer (PDF, PNG, JPG)</Label>
                <Input id="file" type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-2" />
                {file && <p className="mt-2 text-xs text-muted-foreground">Selected: {file.name}</p>}
              </div>
            </TabsContent>

            <TabsContent value="design" className="pt-6">
              <p className="text-sm text-muted-foreground">No file needed — just tell us about it below.</p>
            </TabsContent>
          </Tabs>

          <div>
            <Label htmlFor="title">Job title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer launch flyer" className="mt-2" />
          </div>

          <div>
            <Label htmlFor="brief">{type === "design" ? "Brief (required)" : "Notes (optional)"}</Label>
            <Textarea id="brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={5}
              placeholder={type === "design"
                ? "Tell us about your business/event, audience, key info, colors, vibe..."
                : "Anything we should know about your flyer or interactions"}
              className="mt-2" />
          </div>

          <div>
            <Label>Pick your interactions ({selected.length} selected)</Label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {INTERACTIONS.map((it) => {
                const on = selected.includes(it.id);
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => toggle(it.id)}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      on ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${on ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                      {on ? <CheckCircle2 className="h-4 w-4" /> : <it.icon className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{it.label}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{it.short}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <Button size="lg" onClick={submit} disabled={submitting} className="w-full shadow-glow">
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit job"}
          </Button>
        </div>
      </main>
    </div>
  );
}

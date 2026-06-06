import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Pencil, Trash2 } from "lucide-react";

type Example = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  sort_order: number;
};

const emptyForm = { url: "", title: "", description: "", thumbnail_url: "", sort_order: 0 };

export default function AdminExamples() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [items, setItems] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Example | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadThumb = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `examples/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("flyer-thumbnails").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("flyer-thumbnails").getPublicUrl(path);
      setForm((f) => ({ ...f, thumbnail_url: data.publicUrl }));
      toast.success("Thumbnail uploaded");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("example_flyers")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setItems((data as Example[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (authLoading || isAdmin === null) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (ex: Example) => {
    setEditing(ex);
    setForm({
      url: ex.url, title: ex.title,
      description: ex.description ?? "",
      thumbnail_url: ex.thumbnail_url ?? "",
      sort_order: ex.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.url.trim() || !form.title.trim()) {
      toast.error("Title and URL are required");
      return;
    }
    setSaving(true);
    const payload = {
      url: form.url.trim(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
      sort_order: Number(form.sort_order) || 0,
    };
    const { error } = editing
      ? await supabase.from("example_flyers").update(payload).eq("id", editing.id)
      : await supabase.from("example_flyers").insert([payload]);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Updated" : "Added");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this example?")) return;
    const { error } = await supabase.from("example_flyers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm"><Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Dashboard</Link></Button>
            <h1 className="font-display text-xl font-bold">Manage Examples</h1>
          </div>
          <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Add example</Button>
        </div>
      </header>

      <main className="container py-8">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <Card className="mx-auto max-w-md p-10 text-center text-muted-foreground">
            No examples yet. Click "Add example" to post your first flyer link.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((ex) => (
              <Card key={ex.id} className="overflow-hidden">
                <div className="aspect-[3/4] gradient-canvas border-b border-border">
                  {ex.thumbnail_url && <img src={ex.thumbnail_url} alt={ex.title} className="h-full w-full object-cover" />}
                </div>
                <div className="p-4 space-y-2">
                  <div className="font-semibold truncate">{ex.title}</div>
                  <a href={ex.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary hover:underline">{ex.url}</a>
                  <div className="text-xs text-muted-foreground">Order: {ex.sort_order}</div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(ex)}><Pencil className="mr-1 h-3 w-3" /> Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(ex.id)}><Trash2 className="mr-1 h-3 w-3" /> Delete</Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit example" : "Add example"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="My awesome flyer" />
            </div>
            <div>
              <Label>Flyer URL</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://tapthatflyer.com/f/your-slug" />
            </div>
            <div>
              <Label>Thumbnail image URL (optional)</Label>
              <Input value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://..." />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Sort order (lower = first)</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  website_url: string;
  facebook_url: string;
  facebook_page_name: string;
  instagram_url: string;
  instagram_handle: string;
  tiktok_url: string;
  other_social_url: string;
  social_help: boolean;
  posting_permission: boolean;
  posting_permission_name: string;
}

const EMPTY: FormState = {
  website_url: "",
  facebook_url: "",
  facebook_page_name: "",
  instagram_url: "",
  instagram_handle: "",
  tiktok_url: "",
  other_social_url: "",
  social_help: false,
  posting_permission: false,
  posting_permission_name: "",
};

/** Social account details + written permission for TapThatFlyer to post on the customer's behalf. */
export function SocialPermissionsDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("onboarding_submissions" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) toast.error("Could not load your social details");
      const row = (data as any) ?? null;
      setForm({
        website_url: row?.website_url ?? "",
        facebook_url: row?.facebook_url ?? "",
        facebook_page_name: row?.facebook_page_name ?? "",
        instagram_url: row?.instagram_url ?? "",
        instagram_handle: row?.instagram_handle ?? "",
        tiktok_url: row?.tiktok_url ?? "",
        other_social_url: row?.other_social_url ?? "",
        social_help: Boolean(row?.social_help),
        posting_permission: Boolean(row?.posting_permission),
        posting_permission_name: row?.posting_permission_name ?? "",
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, user?.id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!user?.id) return;
    if (form.posting_permission && !form.posting_permission_name.trim()) {
      toast.error("Type your full name to authorize posting");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("onboarding_submissions" as any)
      .upsert(
        {
          user_id: user.id,
          email: user.email ?? null,
          website_url: form.website_url.trim() || null,
          facebook_url: form.facebook_url.trim() || null,
          facebook_page_name: form.facebook_page_name.trim() || null,
          instagram_url: form.instagram_url.trim() || null,
          instagram_handle: form.instagram_handle.trim() || null,
          tiktok_url: form.tiktok_url.trim() || null,
          other_social_url: form.other_social_url.trim() || null,
          social_help: form.social_help,
          posting_permission: form.posting_permission,
          posting_permission_name: form.posting_permission ? form.posting_permission_name.trim() : null,
          posting_permission_at: form.posting_permission ? new Date().toISOString() : null,
        },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Social details and posting permission saved");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Posting permission &amp; social accounts
          </DialogTitle>
          <DialogDescription>
            Give us the accounts to post to and your written permission to publish on your behalf.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sp-website">Website</Label>
              <Input
                id="sp-website"
                placeholder="https://"
                value={form.website_url}
                onChange={(e) => set("website_url", e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sp-fb">Facebook page URL</Label>
                <Input id="sp-fb" value={form.facebook_url} onChange={(e) => set("facebook_url", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-fbname">Facebook page name</Label>
                <Input
                  id="sp-fbname"
                  value={form.facebook_page_name}
                  onChange={(e) => set("facebook_page_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-ig">Instagram URL</Label>
                <Input id="sp-ig" value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-ighandle">Instagram handle</Label>
                <Input
                  id="sp-ighandle"
                  placeholder="@yourbusiness"
                  value={form.instagram_handle}
                  onChange={(e) => set("instagram_handle", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-tt">TikTok</Label>
                <Input id="sp-tt" value={form.tiktok_url} onChange={(e) => set("tiktok_url", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-other">Other social</Label>
                <Input
                  id="sp-other"
                  value={form.other_social_url}
                  onChange={(e) => set("other_social_url", e.target.value)}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.social_help}
                onCheckedChange={(v) => set("social_help", v === true)}
              />
              Help me set up my social media accounts
            </label>

            <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  className="mt-0.5"
                  checked={form.posting_permission}
                  onCheckedChange={(v) => set("posting_permission", v === true)}
                />
                <span>
                  I authorize TapThatFlyer to publish posts and scheduled content to the accounts listed
                  above on my behalf. I can revoke this permission at any time.
                </span>
              </label>
              {form.posting_permission && (
                <div className="space-y-2">
                  <Label htmlFor="sp-name">Type your full name to authorize</Label>
                  <Input
                    id="sp-name"
                    value={form.posting_permission_name}
                    onChange={(e) => set("posting_permission_name", e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving || loading || !user?.id}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

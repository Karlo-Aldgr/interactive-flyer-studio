import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { loadMyRealtorProfile, updateMyRealtorProfile, uploadRealtorPhoto, type RealtorProfile } from "@/lib/realtorProfile";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: RealtorProfile;
  onSaved: (p: RealtorProfile) => void;
};

export function RealtorProfileEditDialog({ open, onOpenChange, profile, onSaved }: Props) {
  const { user } = useAuth();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [brokerage, setBrokerage] = useState(profile.brokerage ?? "");
  const [headline, setHeadline] = useState(profile.headline ?? "");
  const [slug, setSlug] = useState(profile.profile_slug ?? "");
  const [photoUrl, setPhotoUrl] = useState(profile.photo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFullName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
      setBrokerage(profile.brokerage ?? "");
      setHeadline(profile.headline ?? "");
      setSlug(profile.profile_slug ?? "");
      setPhotoUrl(profile.photo_url ?? "");
    }
  }, [open, profile]);

  const handlePhoto = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadRealtorPhoto(user.id, file);
      setPhotoUrl(url);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateMyRealtorProfile({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        brokerage: brokerage.trim() || null,
        headline: headline.trim() || null,
        profile_slug: slug.trim() || null,
        photo_url: photoUrl || null,
      });
      const fresh = await loadMyRealtorProfile(user.id);
      if (fresh) onSaved(fresh);
      toast.success("Profile updated");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit realtor profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 overflow-hidden rounded-full bg-muted ring-2 ring-border">
              {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handlePhoto(e.target.files[0])}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
                {photoUrl ? "Change photo" : "Upload photo"}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div className="sm:col-span-2">
              <Label>Brokerage / company</Label>
              <Input value={brokerage} onChange={(e) => setBrokerage(e.target.value)} placeholder="Acme Realty" />
            </div>
            <div className="sm:col-span-2">
              <Label>Headline</Label>
              <Textarea
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Helping families find home in the greater area since 2015"
                rows={2}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Public URL</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/r/</span>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="jane-doe" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Lowercase letters, numbers, and dashes only.</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

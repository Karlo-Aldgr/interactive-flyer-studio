import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Mail, Phone, Building2, Edit3, ExternalLink, UserCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RealtorProfileEditDialog } from "./RealtorProfileEditDialog";
import type { RealtorProfile } from "@/lib/realtorProfile";


type Props = {
  profile: RealtorProfile;
  activeCount: number;
  onSaved: (p: RealtorProfile) => void;
};

export function RealtorProfileCard({ profile, activeCount, onSaved }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const publicUrl = profile.profile_slug ? `${window.location.origin}/r/${profile.profile_slug}` : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted ring-2 ring-border">
          {profile.photo_url ? (
            <img src={profile.photo_url} alt={profile.full_name ?? "Realtor"} className="h-full w-full object-cover" />
          ) : (
            <UserCircle2 className="h-12 w-12 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-semibold">
              {profile.full_name || profile.email?.split("@")[0] || "Your name"}
            </h2>
            <Badge variant="secondary">{activeCount} active</Badge>
          </div>
          {profile.headline && (
            <p className="mt-0.5 text-sm text-muted-foreground">{profile.headline}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {profile.brokerage && (
              <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{profile.brokerage}</span>
            )}
            {profile.phone && (
              <a href={`tel:${profile.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Phone className="h-3.5 w-3.5" />{profile.phone}
              </a>
            )}
            {profile.email && (
              <a href={`mailto:${profile.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Mail className="h-3.5 w-3.5" />{profile.email}
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Edit3 className="mr-1 h-3.5 w-3.5" />Edit profile
          </Button>
          {publicUrl ? (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />View public page
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">Set a URL to enable your public page</span>
          )}
        </div>
      </div>

      {publicUrl && (
        <div className="flex flex-col items-start gap-3 border-t border-border bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative rounded-lg border border-border bg-background p-2">
              <QRCodeCanvas id="realtor-qr" value={publicUrl} size={96} includeMargin={false} />
              <div className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none">
                <QRCodeCanvas id="realtor-qr-hd" value={publicUrl} size={512} includeMargin={false} />
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your public page</div>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-primary hover:underline">
                {publicUrl}
              </a>
              <div className="mt-1 text-xs text-muted-foreground">Scan or share to send buyers to your listings page.</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(publicUrl);
                toast.success("Link copied");
              }}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />Copy link
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const hdCanvas = document.getElementById("realtor-qr-hd") as HTMLCanvasElement | null;
                const canvas = hdCanvas ?? document.getElementById("realtor-qr") as HTMLCanvasElement | null;
                if (!canvas) return;
                const link = document.createElement("a");
                const base = (profile.full_name || "realtor").replace(/[^a-z0-9]+/gi, "-");
                link.download = `${base}-qr.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
              }}
            >
              <Download className="mr-1 h-3.5 w-3.5" />Download QR
            </Button>
          </div>
        </div>
      )}



      <RealtorProfileEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        profile={profile}
        onSaved={onSaved}
      />
    </Card>
  );
}

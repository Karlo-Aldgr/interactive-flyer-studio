import { type ComponentType, type ReactNode } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Phone, MessageSquare, Mail, MapPin, FileImage, UserPlus,
  Facebook, Instagram, Globe, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPublicBizadUrl } from "@/lib/utils";
import { BIZAD_DEFAULT_BACKGROUND_COLOR, BIZAD_DEFAULT_BUTTON_COLOR } from "@/lib/bizadDefaults";
import { downloadVCard, buildMapsUrl, type BizadRecord } from "@/lib/bizad";

function HotButton({
  href,
  label,
  icon: Icon,
  color,
  external,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  external?: boolean;
}) {
  const className =
    "flex flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-4 text-center text-xs font-medium text-white shadow-sm transition hover:opacity-90";
  const style = { backgroundColor: color };

  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className} style={style}>
        <Icon className="h-5 w-5" />
        {label}
      </a>
    );
  }

  return (
    <a href={href} className={className} style={style}>
      <Icon className="h-5 w-5" />
      {label}
    </a>
  );
}

function SocialButton({ href, label, children, color }: { href: string; label: string; children: ReactNode; color: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-sm transition hover:opacity-90"
      style={{ backgroundColor: color }}
    >
      {children}
    </a>
  );
}

function toEmbedVideoUrl(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;
  if (raw.includes("youtube.com/watch")) {
    const id = new URL(raw).searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : raw;
  }
  if (raw.includes("youtu.be/")) {
    const id = raw.split("youtu.be/")[1]?.split(/[?#]/)[0];
    return id ? `https://www.youtube.com/embed/${id}` : raw;
  }
  return raw;
}

function BizadVideo({ url }: { url: string }) {
  const embed = toEmbedVideoUrl(url);
  if (!embed) return null;

  const isDirect = /\.(mp4|webm|mov)(\?|$)/i.test(embed) || embed.startsWith("blob:");

  return (
    <section className="mt-6 w-full overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-black/5">
      {isDirect ? (
        <video src={embed} controls playsInline className="aspect-video w-full bg-black" />
      ) : (
        <iframe
          src={embed}
          title="Business video"
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )}
    </section>
  );
}

function shouldShowOwnerPhoto(bizad: BizadRecord): boolean {
  if (!bizad.owner_photo_url?.trim()) return false;
  if (!bizad.logo_url?.trim()) return true;
  return bizad.owner_photo_url.trim() !== bizad.logo_url.trim();
}

export function BizadPageContent({
  bizad,
  preview = false,
}: {
  bizad: BizadRecord;
  /** When true, links and Save Contact are non-interactive (editor preview). */
  preview?: boolean;
}) {
  const publicUrl = buildPublicBizadUrl(bizad.slug);
  const btn = bizad.button_color || BIZAD_DEFAULT_BUTTON_COLOR;
  const bg = bizad.background_color || BIZAD_DEFAULT_BACKGROUND_COLOR;
  const phoneDigits = bizad.phone?.replace(/[^\d+]/g, "") ?? "";
  const copyright =
    bizad.copyright_text?.trim() ||
    (bizad.business_name ? `© ${bizad.business_name}` : "©");
  const showOwnerPhoto = shouldShowOwnerPhoto(bizad);

  const socials = [
    { key: "facebook", url: bizad.social_links?.facebook, icon: <Facebook className="h-5 w-5" />, label: "Facebook" },
    { key: "instagram", url: bizad.social_links?.instagram, icon: <Instagram className="h-5 w-5" />, label: "Instagram" },
    { key: "website", url: bizad.social_links?.website, icon: <Globe className="h-5 w-5" />, label: "Website" },
    { key: "tiktok", url: bizad.social_links?.tiktok, icon: <ExternalLink className="h-5 w-5" />, label: "TikTok" },
    { key: "other", url: bizad.social_links?.other, icon: <ExternalLink className="h-5 w-5" />, label: "Social" },
  ].filter((s) => !!s.url?.trim());

  const hotButtons: { key: string; href: string; label: string; icon: ComponentType<{ className?: string }>; external?: boolean }[] = [];
  if (phoneDigits) {
    hotButtons.push({ key: "call", href: `tel:${phoneDigits}`, label: "Call", icon: Phone });
    hotButtons.push({ key: "text", href: `sms:${phoneDigits}`, label: "Text", icon: MessageSquare });
  }
  if (bizad.gallery_url) {
    hotButtons.push({ key: "flyer", href: bizad.gallery_url, label: "Flyer", icon: FileImage, external: true });
  }
  if (bizad.email) {
    hotButtons.push({ key: "email", href: `mailto:${bizad.email}`, label: "Email", icon: Mail });
  }
  if (bizad.address) {
    hotButtons.push({ key: "gps", href: buildMapsUrl(bizad.address), label: "GPS", icon: MapPin, external: true });
  }

  return (
    <div
      className="mx-auto flex min-h-full w-full max-w-[430px] flex-col px-4 py-6"
      style={{ backgroundColor: bg }}
    >
      <div className="flex flex-1 flex-col items-center text-center">
        {bizad.logo_url && (
          <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            <img src={bizad.logo_url} alt={`${bizad.business_name || "Business"} logo`} className="h-full w-full object-contain p-1" />
          </div>
        )}

        <h1 className="font-display text-2xl font-bold text-slate-900">
          {bizad.business_name || "Business"}
        </h1>

        {bizad.flyer_image_url && (
          <div className="mt-4 w-full rounded-2xl bg-white p-2 shadow-md ring-1 ring-black/5">
            <img
              src={bizad.flyer_image_url}
              alt={bizad.business_name || "Flyer"}
              className="aspect-[4/5] w-full rounded-xl object-cover"
            />
          </div>
        )}

        {showOwnerPhoto && (
          <div className="-mt-10 relative z-10 h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-muted shadow-lg">
            <img
              src={bizad.owner_photo_url!}
              alt={bizad.owner_name || "Owner"}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {bizad.owner_name && (
          <p className={`text-sm font-medium text-muted-foreground ${showOwnerPhoto ? "mt-3" : "mt-4"}`}>
            {bizad.owner_name}
          </p>
        )}

        <Button
          type="button"
          className="mt-5 w-full rounded-full py-6 text-base font-semibold text-white shadow-md"
          style={{ backgroundColor: btn }}
          disabled={preview}
          onClick={preview ? undefined : () => downloadVCard(bizad)}
        >
          <UserPlus className="mr-2 h-5 w-5" />
          Save Contact
        </Button>

        {hotButtons.length > 0 && (
          <div className="mt-5 grid w-full grid-cols-3 gap-2">
            {hotButtons.map((b) => (
              preview ? (
                <span
                  key={b.key}
                  className="flex flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-4 text-center text-xs font-medium text-white shadow-sm"
                  style={{ backgroundColor: btn }}
                >
                  <b.icon className="h-5 w-5" />
                  {b.label}
                </span>
              ) : (
                <HotButton
                  key={b.key}
                  href={b.href}
                  label={b.label}
                  icon={b.icon}
                  color={btn}
                  external={b.external}
                />
              )
            ))}
          </div>
        )}

        {bizad.video_url && <BizadVideo url={bizad.video_url} />}

        {bizad.about_text && (
          <section className="mt-8 w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/5">
            <h2 className="font-display text-lg font-semibold text-slate-900">About Us</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {bizad.about_text}
            </p>
          </section>
        )}

        {socials.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {socials.map((s) => (
              preview ? (
                <span
                  key={s.key}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-white shadow-sm"
                  style={{ backgroundColor: btn }}
                  aria-label={s.label}
                >
                  {s.icon}
                </span>
              ) : (
                <SocialButton key={s.key} href={s.url!} label={s.label} color={btn}>
                  {s.icon}
                </SocialButton>
              )
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scan to save</p>
          <QRCodeCanvas value={publicUrl} size={140} includeMargin />
          <p className="max-w-full truncate text-[11px] text-muted-foreground">{publicUrl}</p>
        </div>
      </div>

      <footer className="mt-8 pb-4 text-center text-xs text-muted-foreground">
        {copyright}
      </footer>
    </div>
  );
}

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  Loader2, Phone, MessageSquare, Mail, MapPin, FileImage, UserPlus,
  Facebook, Instagram, Globe, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPublicBizadUrl } from "@/lib/utils";
import { downloadVCard, buildMapsUrl, loadPublicBizad, DEMO_BIZAD, type BizadRecord } from "@/lib/bizad";
import { BizadLayoutView, isBizadLayout } from "@/components/viewer/BizadLayoutView";

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
    <section className="mt-6 w-full overflow-hidden rounded-2xl bg-black shadow-md ring-1 ring-black/5">
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

function BizadContent({ bizad }: { bizad: BizadRecord }) {
  const publicUrl = buildPublicBizadUrl(bizad.slug);
  const btn = bizad.button_color || "#2563eb";
  const phoneDigits = bizad.phone?.replace(/[^\d+]/g, "") ?? "";
  const copyright =
    bizad.copyright_text?.trim() ||
    (bizad.business_name ? `© ${bizad.business_name}` : "©");

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
      className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-4 py-6"
      style={{ backgroundColor: bizad.background_color || "#ffffff" }}
    >
      <div className="flex flex-1 flex-col items-center text-center">
        {bizad.logo_url && (
          <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            <img src={bizad.logo_url} alt={`${bizad.business_name || "Business"} logo`} className="h-full w-full object-contain p-1" />
          </div>
        )}

        <h1 className="font-display text-2xl font-bold text-foreground">
          {bizad.business_name || "Business"}
        </h1>

        {bizad.flyer_image_url && (
          <div className="mt-4 w-full overflow-hidden rounded-2xl shadow-md ring-1 ring-black/5">
            <img
              src={bizad.flyer_image_url}
              alt={bizad.business_name || "Flyer"}
              className="aspect-[4/5] w-full object-cover"
            />
          </div>
        )}

        {bizad.owner_photo_url && (
          <div className="-mt-10 relative z-10 h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-muted shadow-lg">
            <img
              src={bizad.owner_photo_url}
              alt={bizad.owner_name || "Owner"}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {bizad.owner_name && (
          <p className="mt-3 text-sm font-medium text-muted-foreground">{bizad.owner_name}</p>
        )}

        <Button
          className="mt-5 w-full rounded-full py-6 text-base font-semibold text-white shadow-md"
          style={{ backgroundColor: btn }}
          onClick={() => downloadVCard(bizad)}
        >
          <UserPlus className="mr-2 h-5 w-5" />
          Save Contact
        </Button>

        {hotButtons.length > 0 && (
          <div className="mt-5 grid w-full grid-cols-3 gap-2">
            {hotButtons.map((b) => (
              <HotButton
                key={b.key}
                href={b.href}
                label={b.label}
                icon={b.icon}
                color={btn}
                external={b.external}
              />
            ))}
          </div>
        )}

        {bizad.video_url && <BizadVideo url={bizad.video_url} />}

        {bizad.about_text && (
          <section className="mt-8 w-full rounded-2xl bg-white/70 p-4 text-left shadow-sm ring-1 ring-black/5">
            <h2 className="font-display text-lg font-semibold">About Us</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {bizad.about_text}
            </p>
          </section>
        )}

        {socials.length > 0 && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {socials.map((s) => (
              <SocialButton key={s.key} href={s.url!} label={s.label} color={btn}>
                {s.icon}
              </SocialButton>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl bg-white/70 p-5 shadow-sm ring-1 ring-black/5">
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

export default function PublicBizad() {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [bizad, setBizad] = useState<BizadRecord | null>(null);

  useEffect(() => {
    if (!slug) return;
    if (slug === "demo") {
      setBizad(DEMO_BIZAD);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const row = await loadPublicBizad(slug);
      setBizad(row);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (bizad?.business_name) {
      document.title = `${bizad.business_name} — Digital Card`;
    }
  }, [bizad]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!bizad) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="font-display text-2xl font-semibold">Card not found</h1>
        <p className="text-sm text-muted-foreground">This digital business card doesn&apos;t exist or isn&apos;t published yet.</p>
        <Button asChild variant="outline"><Link to="/">Go home</Link></Button>
      </div>
    );
  }

  if (isBizadLayout(bizad.layout)) {
    return <BizadLayoutView layout={bizad.layout} bizad={bizad} />;
  }

  return <BizadContent bizad={bizad} />;
}

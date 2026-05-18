import { useState } from "react";
import { Instagram, Facebook, Youtube, Linkedin, Twitter, Globe, X } from "lucide-react";
import type { SocialSlideoutSettings } from "@/types/flyer";

interface Props {
  settings?: SocialSlideoutSettings;
}

const PLATFORMS: Array<{
  key: keyof SocialSlideoutSettings;
  label: string;
  prefix?: string;
  icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
}> = [
  { key: "instagram", label: "Instagram", prefix: "https://instagram.com/", icon: Instagram },
  { key: "facebook", label: "Facebook", prefix: "https://facebook.com/", icon: Facebook },
  { key: "tiktok", label: "TikTok", prefix: "https://tiktok.com/@", icon: TikTokIcon },
  { key: "twitter", label: "X / Twitter", prefix: "https://x.com/", icon: Twitter },
  { key: "youtube", label: "YouTube", prefix: "https://youtube.com/@", icon: Youtube },
  { key: "linkedin", label: "LinkedIn", prefix: "https://linkedin.com/in/", icon: Linkedin },
  { key: "snapchat", label: "Snapchat", prefix: "https://snapchat.com/add/", icon: SnapchatIcon },
  { key: "threads", label: "Threads", prefix: "https://threads.net/@", icon: ThreadsIcon },
  { key: "website", label: "Website", icon: Globe },
];

function TikTokIcon({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M19.6 6.3a5.6 5.6 0 0 1-3.4-1.1 5.6 5.6 0 0 1-2.2-3.7h-3.2v13.2a2.7 2.7 0 1 1-2-2.6V8.7a5.9 5.9 0 1 0 5.2 5.8V9.3a8.8 8.8 0 0 0 5.6 1.9V6.3z"/>
    </svg>
  );
}
function SnapchatIcon({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M12 2c3.1 0 5.4 2.2 5.4 5.6 0 2.1-.3 3.1-.3 3.1.4.2 1.1.5 1.9.5.4 0 1.3-.1 1.5.6.2.7-1 1.1-1.7 1.3-.7.2-1.4.3-1.4.7s1.4 2.6 3.6 3.3c.6.2.5.7.4.9-.3.8-2.2 1.1-2.7 1.2-.2 0-.3.4-.4.7-.1.4-.3 1.1-1.1 1.1-.6 0-1.1-.3-1.9-.3-1.4 0-2.1 1.5-4.3 1.5s-2.9-1.5-4.3-1.5c-.8 0-1.3.3-1.9.3-.8 0-1-.7-1.1-1.1-.1-.3-.2-.7-.4-.7-.5-.1-2.4-.4-2.7-1.2-.1-.2-.2-.7.4-.9 2.2-.7 3.6-3 3.6-3.3 0-.4-.7-.5-1.4-.7-.7-.2-1.9-.6-1.7-1.3.2-.7 1.1-.6 1.5-.6.8 0 1.5-.3 1.9-.5 0 0-.3-1-.3-3.1C6.6 4.2 8.9 2 12 2z"/>
    </svg>
  );
}
function ThreadsIcon({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M12.2 22h-.1C8.4 22 5.5 20.6 3.9 18 2.6 16 1.9 13.2 1.9 12s.7-4 2-6C5.5 3.4 8.4 2 12.1 2h.1c3.7 0 6.6 1.4 8.2 4 .8 1.3 1.4 2.9 1.6 4.6h-2.3c-.4-3.4-2.7-5.7-7.5-5.7-3 0-5.2 1-6.4 3-1 1.6-1.5 3.7-1.5 4.1 0 .4.5 2.5 1.5 4.1 1.2 2 3.4 3 6.4 3 2.7 0 4.6-.6 5.8-2 .6-.7 1-1.6 1.1-2.6-.4.2-.9.3-1.5.4-2 .2-3.7-.7-4-2.4-.1-.7.1-1.4.5-2 .7-.9 2-1.4 3.6-1.4.3 0 .5 0 .7.1 0-.2-.1-.5-.2-.8-.3-.7-1-1.1-2-1.1-.8 0-1.6.4-1.9 1l-2-1c.7-1.3 2.2-2.1 3.9-2.1 1.9 0 3.4.9 4.1 2.5.3.7.5 1.6.5 2.5 1.1.6 1.8 1.7 1.8 3.2 0 3.4-2.8 5.5-7.5 5.5zm.7-8c-1 0-1.6.4-1.8.7-.1.1-.1.3-.1.4.1.6 1 .9 2.1.8.7-.1 1.3-.3 1.6-.6-.1-.4-.2-.8-.4-1-.4-.2-.9-.3-1.4-.3z"/>
    </svg>
  );
}

export function hasAnySocial(s?: SocialSlideoutSettings): boolean {
  if (!s) return false;
  return PLATFORMS.some((p) => !!(s[p.key] && String(s[p.key]).trim()));
}

function buildUrl(raw: string, prefix?: string): string {
  const v = raw.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (prefix) return prefix + v.replace(/^[@$]/, "");
  return "https://" + v;
}

export function SocialSlideout({ settings }: Props) {
  const [open, setOpen] = useState(false);
  if (!hasAnySocial(settings)) return null;
  const s = settings!;
  const tabBg = s.tabBgColor || "#1a1a1a";
  const tabText = s.tabTextColor || "#ffffff";
  const panelBg = s.panelBgColor || "#1a1a1a";
  const iconColor = s.iconColor || "#ffffff";
  const fontFamily = s.fontFamily || "Inter, system-ui, sans-serif";
  const label = s.label || "SOCIAL MEDIA";

  const active = PLATFORMS.filter((p) => !!(s[p.key] && String(s[p.key]).trim()));

  return (
    <div
      style={{
        position: "absolute",
        right: 0,
        top: "50%",
        transform: "translateY(-50%)",
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        pointerEvents: "auto",
      }}
    >
      {/* Panel */}
      <div
        style={{
          background: panelBg,
          borderTopLeftRadius: 14,
          borderBottomLeftRadius: 14,
          padding: open ? "14px 12px" : "0",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxWidth: open ? 64 : 0,
          overflow: "hidden",
          transition: "max-width 320ms ease, padding 320ms ease",
          boxShadow: open ? "-4px 0 18px rgba(0,0,0,0.25)" : "none",
        }}
      >
        {active.map((p) => {
          const Icon = p.icon;
          const url = buildUrl(String(s[p.key]), p.prefix);
          return (
            <a
              key={p.key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={p.label}
              style={{
                color: iconColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                transition: "transform 150ms ease, opacity 150ms ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1.15)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.transform = "scale(1)"; }}
            >
              <Icon size={24} color={iconColor} />
            </a>
          );
        })}
        {open && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{
              marginTop: 4,
              background: "transparent",
              border: "none",
              color: iconColor,
              opacity: 0.6,
              cursor: "pointer",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Tab */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close social menu" : "Open social menu"}
        style={{
          background: tabBg,
          color: tabText,
          border: "none",
          padding: "16px 6px",
          borderTopLeftRadius: open ? 0 : 10,
          borderBottomLeftRadius: open ? 0 : 10,
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          cursor: "pointer",
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          transform: "rotate(180deg)",
          fontFamily,
          fontWeight: 700,
          letterSpacing: "0.15em",
          fontSize: 13,
          boxShadow: "-2px 0 8px rgba(0,0,0,0.18)",
          minHeight: 150,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </button>
    </div>
  );
}

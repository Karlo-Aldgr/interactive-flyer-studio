import { Facebook, Instagram, Linkedin, Music2, Twitter, Youtube } from "lucide-react";
import type { SocialPlatform } from "@/lib/social/types";

const ICONS: Record<SocialPlatform, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: Music2,
  linkedin: Linkedin,
  x: Twitter,
  youtube: Youtube,
};

export function PlatformIcon({
  platform,
  className = "h-4 w-4",
}: {
  platform: SocialPlatform;
  className?: string;
}) {
  const Icon = ICONS[platform];
  return <Icon className={className} aria-hidden />;
}

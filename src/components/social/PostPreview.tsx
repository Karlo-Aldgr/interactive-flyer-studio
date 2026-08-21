import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformIcon } from "./PlatformIcon";
import { assetPreviewUrl } from "@/lib/social/api";
import { PLATFORM_LABEL } from "@/lib/social/types";
import type { SocialMediaItem, SocialPlatform } from "@/lib/social/types";

/** TapThatFlyer preview — an approximation, not the platform's official renderer. */
export function PostPreview({
  platform,
  accountName,
  caption,
  hashtags,
  link,
  media,
}: {
  platform: SocialPlatform;
  accountName: string;
  caption: string;
  hashtags: string[];
  link: string | null;
  media: SocialMediaItem[];
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  const first = media[0];

  useEffect(() => {
    let alive = true;
    if (!first) {
      setThumb(null);
      return;
    }
    assetPreviewUrl(first).then((u) => alive && setThumb(u));
    return () => {
      alive = false;
    };
  }, [first]);

  const tags = hashtags.length ? hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ") : "";

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <PlatformIcon platform={platform} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{accountName}</p>
            <p className="text-xs text-muted-foreground">
              {PLATFORM_LABEL[platform]} · TapThatFlyer preview
            </p>
          </div>
        </div>
        {caption
          ? <p className="whitespace-pre-wrap text-sm">{caption}</p>
          : <p className="text-sm italic text-muted-foreground">No caption yet.</p>}
        {tags && <p className="text-sm text-primary">{tags}</p>}
        {thumb && (
          first.type === "video"
            ? <video src={thumb} controls className="w-full rounded-md" />
            : <img src={thumb} alt="" loading="lazy" className="w-full rounded-md object-cover" />
        )}
        {link && (
          <div className="rounded-md border p-2 text-xs">
            <p className="truncate text-muted-foreground">{link}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

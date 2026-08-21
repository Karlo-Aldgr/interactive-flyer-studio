import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { assetPreviewUrl, uploadAsset } from "@/lib/social/api";
import type { SocialMediaItem } from "@/lib/social/types";

function MediaThumb({ item, onRemove }: { item: SocialMediaItem; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    assetPreviewUrl(item).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [item]);

  return (
    <div className="group relative h-24 w-24 overflow-hidden rounded-md border bg-muted">
      {url
        ? item.type === "video"
          ? <video src={url} className="h-full w-full object-cover" muted />
          : <img src={url} alt={item.file_name ?? "Selected media"} className="h-full w-full object-cover" loading="lazy" />
        : <div className="flex h-full items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove media"
        className="absolute right-1 top-1 rounded bg-background/90 p-1 opacity-0 transition group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function MediaPicker({
  media,
  onChange,
  disabled,
}: {
  media: SocialMediaItem[];
  onChange: (next: SocialMediaItem[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const added: SocialMediaItem[] = [];
    for (const file of Array.from(files)) {
      try {
        added.push(await uploadAsset(file));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Could not upload ${file.name}`);
      }
    }
    if (added.length) onChange([...media, ...added]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {media.map((item, index) => (
          <MediaThumb
            key={item.path ?? item.url ?? index}
            item={item}
            onRemove={() => onChange(media.filter((_, i) => i !== index))}
          />
        ))}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
        Upload images or video
      </Button>
      <p className="text-xs text-muted-foreground">
        Stored privately. Platforms receive a temporary signed link at publish time.
      </p>
    </div>
  );
}

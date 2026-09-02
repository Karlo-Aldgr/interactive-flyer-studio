import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/store/editorStore";
import { ensureUuid } from "@/lib/safeBrowser";

type Props = {
  layerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CopyButtonLinkDialog({ layerId, open, onOpenChange }: Props) {
  const setLayerAction = useEditorStore((s) => s.setLayerAction);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (open) setUrl("");
  }, [open, layerId]);

  function close() {
    onOpenChange(false);
    setUrl("");
  }

  function saveLink() {
    if (!layerId) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    setLayerAction(layerId, {
      id: ensureUuid(undefined),
      type: "open_url",
      payload: { url: trimmed, newTab: true },
    });
    close();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Where should this button link?</DialogTitle>
          <DialogDescription>
            The copied button keeps the same style. Add a URL now or skip and set the link later in the Inspector.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label htmlFor="copy-button-url">Link URL</Label>
          <Input
            id="copy-button-url"
            className="mt-1"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={(e) => {
              if (e.key === "Enter") saveLink();
            }}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={close}>
            Skip for now
          </Button>
          <Button type="button" onClick={saveLink} disabled={!url.trim()}>
            Save link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

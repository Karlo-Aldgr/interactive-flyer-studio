import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DEFAULT_WEBSITE_SECTIONS,
  WEBSITE_SECTION_OPTIONS,
  type WebsiteSectionKey,
} from "@/lib/websiteProfile";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the sections the client picked. */
  onConfirm: (sections: WebsiteSectionKey[]) => void;
  loading?: boolean;
};

/** Asks which sections should be part of the website before it is generated. */
export function WebsiteSectionsDialog({ open, onOpenChange, onConfirm, loading }: Props) {
  const [selected, setSelected] = useState<WebsiteSectionKey[]>(DEFAULT_WEBSITE_SECTIONS);

  useEffect(() => {
    if (open) setSelected(DEFAULT_WEBSITE_SECTIONS);
  }, [open]);

  const toggle = (key: WebsiteSectionKey) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose your website sections</DialogTitle>
          <DialogDescription>
            Pick which sections belong on this website. The header, hero and footer are always
            included — everything else is only added when it is checked here.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{selected.length} of {WEBSITE_SECTION_OPTIONS.length} selected</span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(DEFAULT_WEBSITE_SECTIONS)}>
              Select all
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {WEBSITE_SECTION_OPTIONS.map((opt) => {
            const checked = selected.includes(opt.key);
            return (
              <label
                key={opt.key}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                  checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(opt.key)} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground">{opt.description}</span>
                </span>
              </label>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={loading} onClick={() => onConfirm(selected)}>
            {loading ? "Building website..." : "Create website"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

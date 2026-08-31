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
import {
  DEFAULT_WEBSITE_TEMPLATE,
  WEBSITE_TEMPLATES,
  type WebsiteTemplateId,
} from "@/lib/websiteTemplates";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the template and the sections the client picked. */
  onConfirm: (sections: WebsiteSectionKey[], templateId: WebsiteTemplateId) => void;
  loading?: boolean;
};

/** Asks which template and which sections should be part of the website before it is generated. */
export function WebsiteSectionsDialog({ open, onOpenChange, onConfirm, loading }: Props) {
  const [selected, setSelected] = useState<WebsiteSectionKey[]>(DEFAULT_WEBSITE_SECTIONS);
  const [template, setTemplate] = useState<WebsiteTemplateId>(DEFAULT_WEBSITE_TEMPLATE);

  useEffect(() => {
    if (open) {
      setSelected(DEFAULT_WEBSITE_SECTIONS);
      setTemplate(DEFAULT_WEBSITE_TEMPLATE);
    }
  }, [open]);

  const toggle = (key: WebsiteSectionKey) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose your website template &amp; sections</DialogTitle>
          <DialogDescription>
            Pick a design, then pick which sections belong on this website. The header, hero and
            footer are always included — everything else is only added when it is checked here.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {WEBSITE_TEMPLATES.map((tpl) => {
            const active = template === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setTemplate(tpl.id)}
                className={`overflow-hidden rounded-lg border text-left transition-colors ${
                  active ? "border-primary ring-2 ring-primary/40" : "border-border hover:bg-muted/40"
                }`}
              >
                <img
                  src={tpl.thumbnail}
                  alt={`${tpl.name} website template preview`}
                  loading="lazy"
                  width={800}
                  height={600}
                  className="h-24 w-full object-cover"
                />
                <span className="block p-3">
                  <span className="block text-sm font-medium text-foreground">{tpl.name}</span>
                  <span className="block text-xs text-muted-foreground">{tpl.description}</span>
                </span>
              </button>
            );
          })}
        </div>

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
          <Button type="button" disabled={loading} onClick={() => onConfirm(selected, template)}>
            {loading ? "Building website..." : "Create website"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

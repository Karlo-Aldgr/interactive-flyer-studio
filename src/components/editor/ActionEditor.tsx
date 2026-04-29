import { useEffect, useState } from "react";
import { ActionType, LayerAction } from "@/types/flyer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useEditorStore } from "@/store/editorStore";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Lock, Save, Undo2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  action: LayerAction | null;
  onChange: (a: LayerAction | null) => void;
}

const ACTION_LABELS: Record<ActionType | "none", string> = {
  none: "No action",
  open_url: "Open URL",
  popup: "Show popup",
  video: "Play video",
  call: "Call phone",
  sms: "Send SMS",
  form: "Capture form",
  navigate: "Go to page",
  reveal: "Reveal layer",
  add_to_calendar: "Add to calendar",
};

function toLocalInputValue(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

function isValid(draft: LayerAction | null): boolean {
  if (!draft) return true;
  const p = draft.payload || {};
  switch (draft.type) {
    case "open_url": return !!p.url;
    case "popup": return !!(p.title || p.body);
    case "video": return !!p.videoUrl;
    case "call": return !!p.phone;
    case "sms": return !!p.phone;
    case "form": return !!(p.fields && p.fields.length);
    case "navigate": return !!p.pageId;
    case "reveal": return !!(p.targetLayerIds && p.targetLayerIds.length);
    case "add_to_calendar": return !!(p.eventTitle && p.startISO);
    default: return true;
  }
}

export function ActionEditor({ action, onChange }: Props) {
  const pages = useEditorStore((s) => s.pages);
  const selectedPageId = useEditorStore((s) => s.selectedPageId);
  const currentPage = pages.find((p) => p.id === selectedPageId);

  const [draft, setDraft] = useState<LayerAction | null>(action);

  // Reset draft when underlying layer/action changes
  useEffect(() => { setDraft(action); }, [action?.id, action?.type, JSON.stringify(action?.payload)]);

  const type = draft?.type ?? "none";
  const p = draft?.payload ?? {};

  const update = (patch: any) =>
    setDraft({
      id: draft?.id || crypto.randomUUID(),
      type: type as ActionType,
      payload: { ...p, ...patch },
    });

  const dirty = JSON.stringify(draft) !== JSON.stringify(action);
  const valid = isValid(draft);

  function save() {
    onChange(draft);
    toast.success(draft ? "Action saved" : "Action cleared");
  }

  function discard() {
    setDraft(action);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto">
        <div>
          <Label className="text-xs">Action type</Label>
          <Select
            value={type}
            onValueChange={(v) => {
              if (v === "none") setDraft(null);
              else setDraft({ id: draft?.id || crypto.randomUUID(), type: v as ActionType, payload: {} });
            }}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {type === "open_url" && (
          <>
            <div>
              <Label className="text-xs">URL</Label>
              <Input className="mt-1" value={p.url || ""} onChange={(e) => update({ url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Open in new tab</Label>
              <Switch checked={p.newTab ?? true} onCheckedChange={(v) => update({ newTab: v })} />
            </div>
          </>
        )}

        {type === "popup" && (
          <>
            <div>
              <Label className="text-xs">Title</Label>
              <Input className="mt-1" value={p.title || ""} onChange={(e) => update({ title: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Body</Label>
              <Textarea className="mt-1" rows={3} value={p.body || ""} onChange={(e) => update({ body: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Image URL (optional)</Label>
              <Input className="mt-1" value={p.mediaUrl || ""} onChange={(e) => update({ mediaUrl: e.target.value })} />
            </div>
          </>
        )}

        {type === "video" && (
          <div>
            <Label className="text-xs">Video URL (YouTube, Vimeo, mp4)</Label>
            <Input className="mt-1" value={p.videoUrl || ""} onChange={(e) => update({ videoUrl: e.target.value })} />
          </div>
        )}

        {type === "call" && (
          <div>
            <Label className="text-xs">Phone number</Label>
            <Input className="mt-1" value={p.phone || ""} onChange={(e) => update({ phone: e.target.value })} placeholder="+1..." />
          </div>
        )}

        {type === "sms" && (
          <>
            <div>
              <Label className="text-xs">Phone number</Label>
              <Input className="mt-1" value={p.phone || ""} onChange={(e) => update({ phone: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Prefilled message</Label>
              <Textarea className="mt-1" rows={2} value={p.message || ""} onChange={(e) => update({ message: e.target.value })} />
            </div>
          </>
        )}

        {type === "form" && (
          <>
            <Label className="text-xs">Fields to collect</Label>
            {(["name", "email", "phone"] as const).map((f) => {
              const enabled = (p.fields || []).includes(f);
              return (
                <div key={f} className="flex items-center gap-2">
                  <Checkbox
                    checked={enabled}
                    onCheckedChange={(v) => {
                      const set = new Set(p.fields || []);
                      if (v) set.add(f); else set.delete(f);
                      update({ fields: Array.from(set) });
                    }}
                  />
                  <Label className="text-sm capitalize">{f}</Label>
                </div>
              );
            })}
            <div>
              <Label className="text-xs">Success message</Label>
              <Input className="mt-1" value={p.successMessage || ""} onChange={(e) => update({ successMessage: e.target.value })} />
            </div>
          </>
        )}

        {type === "navigate" && (
          <div>
            <Label className="text-xs">Go to page</Label>
            <Select value={p.pageId || ""} onValueChange={(v) => update({ pageId: v })}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Pick a page" /></SelectTrigger>
              <SelectContent>
                {pages.map((pg) => (
                  <SelectItem key={pg.id} value={pg.id}>{pg.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {type === "reveal" && (
          <div>
            <Label className="text-xs">Layers to reveal on this page</Label>
            <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded border border-border p-2">
              {currentPage?.layers.map((l) => {
                const ids = p.targetLayerIds || [];
                const checked = ids.includes(l.id);
                return (
                  <div key={l.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        const set = new Set(ids);
                        if (v) set.add(l.id); else set.delete(l.id);
                        update({ targetLayerIds: Array.from(set) });
                      }}
                    />
                    <span className="truncate">{l.content.text || l.content.label || l.type}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {type === "add_to_calendar" && (
          <>
            <div>
              <Label className="text-xs">Event title</Label>
              <Input className="mt-1" value={p.eventTitle || ""} onChange={(e) => update({ eventTitle: e.target.value })} placeholder="Summer launch party" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea className="mt-1" rows={2} value={p.eventDescription || ""} onChange={(e) => update({ eventDescription: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input className="mt-1" value={p.eventLocation || ""} onChange={(e) => update({ eventLocation: e.target.value })} placeholder="123 Main St or Zoom link" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">All-day</Label>
              <Switch checked={!!p.allDay} onCheckedChange={(v) => update({ allDay: v })} />
            </div>
            <div>
              <Label className="text-xs">Starts</Label>
              <Input
                type={p.allDay ? "date" : "datetime-local"}
                className="mt-1"
                value={p.allDay ? (p.startISO ? p.startISO.slice(0, 10) : "") : toLocalInputValue(p.startISO)}
                onChange={(e) =>
                  update({
                    startISO: p.allDay
                      ? (e.target.value ? new Date(e.target.value + "T00:00:00").toISOString() : undefined)
                      : fromLocalInputValue(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Ends</Label>
              <Input
                type={p.allDay ? "date" : "datetime-local"}
                className="mt-1"
                value={p.allDay ? (p.endISO ? p.endISO.slice(0, 10) : "") : toLocalInputValue(p.endISO)}
                onChange={(e) =>
                  update({
                    endISO: p.allDay
                      ? (e.target.value ? new Date(e.target.value + "T00:00:00").toISOString() : undefined)
                      : fromLocalInputValue(e.target.value),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Behavior on click</Label>
              <Select value={p.calendarMode || "ics"} onValueChange={(v) => update({ calendarMode: v as any })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ics">Download .ics file</SelectItem>
                  <SelectItem value="google">Open Google Calendar</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">.ics works with Apple Calendar, Outlook, and most clients.</p>
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 mt-3 -mx-3 border-t border-border bg-card px-3 pt-3">
        <div className="mb-2 flex items-center gap-2 text-[11px]">
          {dirty ? (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes
            </span>
          ) : action ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Lock className="h-3 w-3" /> Action saved
            </span>
          ) : (
            <span className="text-muted-foreground">No action set</span>
          )}
          {dirty && !valid && <span className="text-destructive">Required fields missing</span>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={save} disabled={!dirty || !valid}>
            <Save className="mr-1 h-3.5 w-3.5" /> Save action
          </Button>
          <Button size="sm" variant="ghost" onClick={discard} disabled={!dirty}>
            <Undo2 className="mr-1 h-3.5 w-3.5" /> Discard
          </Button>
        </div>
      </div>
    </div>
  );
}

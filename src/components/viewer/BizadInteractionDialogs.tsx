import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronLeft, Package, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { runAddToCalendar } from "@/lib/calendarHelpers";
import type { LayerAction } from "@/types/flyer";
import { AirBubble } from "@/components/AirBubble";

/* ---------------- form / rsvp ---------------- */

export function BizadFormDialog({
  action, flyerId, layerId, onClose,
}: { action: LayerAction | null; flyerId: string | null; layerId?: string | null; onClose: () => void }) {
  const [data, setData] = useState<Record<string, string>>({});
  useEffect(() => { setData({}); }, [action?.id]);
  if (!action) return null;

  const isRsvp = action.type === "rsvp";
  const fields = (isRsvp ? action.payload.rsvpFields : action.payload.fields) || [];

  async function submit() {
    for (const f of fields) {
      if (!data[f]) { toast.error(`Please enter your ${f}`); return; }
    }
    if (flyerId) {
      const { error } = await supabase.from("form_submissions").insert([{
        flyer_id: flyerId,
        layer_id: layerId || null,
        data: { ...data, _preset: isRsvp ? "rsvp" : "form", _source: "bizad" } as any,
      }]);
      if (error) { toast.error("Could not submit"); return; }
    }
    toast.success(action!.payload.successMessage || (isRsvp ? "Thanks for your RSVP!" : "Thanks!"));
    const offerCalendar = isRsvp && action!.payload.rsvpAddToCalendar && action!.payload.eventTitle && action!.payload.startISO;
    const calPayload = action!.payload;
    onClose();
    if (offerCalendar) setTimeout(() => runAddToCalendar(calPayload), 100);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action.payload.title || (isRsvp ? "RSVP" : "Get in touch")}</DialogTitle>
          {action.payload.body && (
            <DialogDescription className="whitespace-pre-wrap">{action.payload.body}</DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f}>
              <Label className="text-xs capitalize">{f}</Label>
              <Input
                type={f === "email" ? "email" : f === "phone" ? "tel" : "text"}
                value={data[f] || ""}
                onChange={(e) => setData((d) => ({ ...d, [f]: e.target.value }))}
              />
            </div>
          ))}
          <Button className="w-full" onClick={submit}>{isRsvp ? "Confirm RSVP" : "Submit"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- subscribe ---------------- */

export function BizadSubscribeDialog({
  action, flyerId, onClose,
}: { action: LayerAction | null; flyerId: string | null; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm({ name: "", email: "", phone: "" }); }, [action?.id]);
  if (!action) return null;
  const p = action.payload;

  async function submit() {
    const nameRequired = p.subscribeNameRequired ?? true;
    const phoneEnabled = !!p.subscribePhoneEnabled;
    const email = form.email.trim();
    const name = form.name.trim();
    const phone = form.phone.trim();
    if (nameRequired && !name) return toast.error("Please enter your name");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Please enter a valid email");
    if (phoneEnabled && p.subscribePhoneRequired && !phone) return toast.error("Please enter your phone");
    if (name.length > 200 || email.length > 320 || phone.length > 40) return toast.error("Input too long");
    if (!flyerId) { toast.success(p.subscribeSuccessMessage || "You're in!"); onClose(); return; }
    setBusy(true);
    const { error } = await supabase.from("subscribers").insert([{
      flyer_id: flyerId,
      name: name || null,
      email: email.toLowerCase(),
      phone: phoneEnabled && phone ? phone : null,
      list_name: p.subscribeListName || null,
      source: "bizad",
    }]);
    setBusy(false);
    if (error && (error as any).code !== "23505") { toast.error("Could not subscribe — try again"); return; }
    toast.success(p.subscribeSuccessMessage || "You're in! Thanks for subscribing.");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{p.subscribeTitle || "Join our list"}</DialogTitle>
          {p.subscribeBody && <DialogDescription className="whitespace-pre-wrap">{p.subscribeBody}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name {(p.subscribeNameRequired ?? true) ? "" : "(optional)"}</Label>
            <Input value={form.name} maxLength={200} onChange={(e) => setForm((d) => ({ ...d, name: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input type="email" value={form.email} maxLength={320} onChange={(e) => setForm((d) => ({ ...d, email: e.target.value }))} />
          </div>
          {p.subscribePhoneEnabled && (
            <div>
              <Label className="text-xs">Phone {p.subscribePhoneRequired ? "" : "(optional)"}</Label>
              <Input type="tel" value={form.phone} maxLength={40} onChange={(e) => setForm((d) => ({ ...d, phone: e.target.value }))} />
            </div>
          )}
          <Button className="w-full" disabled={busy} onClick={submit}>
            {busy ? "Subscribing..." : (p.subscribeButtonLabel || "Subscribe")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- poll ---------------- */

const POLL_SESSION_KEY = "flyer_poll_session";

function getPollSessionId(): string {
  try {
    let id = localStorage.getItem(POLL_SESSION_KEY);
    if (!id) {
      id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : "anon-" + Math.random().toString(36).slice(2);
      localStorage.setItem(POLL_SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2);
  }
}

export function BizadPollDialog({
  action, flyerId, onClose,
}: { action: LayerAction | null; flyerId: string | null; onClose: () => void }) {
  const options = action?.payload.pollOptions || [];
  const multiple = !!action?.payload.pollMultiple;
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [voted, setVoted] = useState(false);
  const sessionId = useMemo(() => getPollSessionId(), []);

  useEffect(() => {
    if (!action) return;
    setVoted(false); setMyVotes(new Set()); setCounts({});
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("poll_votes").select("option_id, session_id").eq("action_id", action.id);
      if (cancelled) return;
      const c: Record<string, number> = {};
      const mine = new Set<string>();
      (data || []).forEach((row: any) => {
        c[row.option_id] = (c[row.option_id] || 0) + 1;
        if (row.session_id === sessionId) mine.add(row.option_id);
      });
      setCounts(c); setMyVotes(mine);
      if (mine.size > 0) setVoted(true);
    })();
    return () => { cancelled = true; };
  }, [action?.id, sessionId]);

  if (!action) return null;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  async function vote(optionId: string) {
    if (voted && !multiple) return;
    if (myVotes.has(optionId)) return;
    if (!flyerId) { toast.info("Voting isn't available here"); return; }
    setLoading(true);
    const { error } = await supabase.from("poll_votes").insert([{
      action_id: action!.id, flyer_id: flyerId, session_id: sessionId, option_id: optionId,
    }] as any);
    setLoading(false);
    if (error) { toast.error("Could not record your vote"); return; }
    setMyVotes((m) => new Set(m).add(optionId));
    if (!multiple) setVoted(true);
    toast.success("Vote recorded");
  }

  const showResults = voted || myVotes.size > 0;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{action.payload.pollQuestion || "Poll"}</DialogTitle>
          <DialogDescription>
            {multiple ? "Pick all that apply." : "Tap an option to vote."} {total > 0 && `· ${total} vote${total === 1 ? "" : "s"}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {options.map((o) => {
            const c = counts[o.id] || 0;
            const pct = total > 0 ? Math.round((c / total) * 100) : 0;
            const mine = myVotes.has(o.id);
            const disabled = (voted && !multiple && !mine) || mine;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => vote(o.id)}
                disabled={disabled || loading}
                className={`relative w-full overflow-hidden rounded-md border text-left transition ${
                  mine ? "border-primary bg-primary/5" : disabled ? "border-border bg-muted/30" : "border-border bg-card hover:border-primary/60"
                }`}
              >
                {showResults && (
                  <div className="absolute inset-y-0 left-0 bg-primary/15 transition-all" style={{ width: `${pct}%` }} />
                )}
                <div className="relative flex items-center justify-between px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {mine && <Check className="h-4 w-4 text-primary" />}
                    {o.label || "(empty)"}
                  </span>
                  {showResults && <span className="text-xs font-semibold text-muted-foreground">{pct}% · {c}</span>}
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- realtor gallery ---------------- */

export function BizadRealtorGalleryDialog({
  action, onClose,
}: { action: LayerAction | null; onClose: () => void }) {
  const listingId = action?.payload.realtorListingId;
  const [photos, setPhotos] = useState<{ id: string; url: string; caption: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    if (!action || !listingId) return;
    setLoading(true); setPhotos([]); setZoom(null);
    (async () => {
      const { data } = await supabase
        .from("listing_photos" as any)
        .select("id, url, caption, position")
        .eq("flyer_id", listingId)
        .order("position", { ascending: true });
      setPhotos(((data as any[]) ?? []).map((p) => ({ id: p.id, url: p.url, caption: p.caption })));
      setLoading(false);
    })();
  }, [action?.id, listingId]);

  if (!action) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{action.payload.realtorGalleryTitle || "Property photos"}</DialogTitle>
          <DialogDescription className="sr-only">Property photo gallery</DialogDescription>
        </DialogHeader>
        {zoom ? (
          <button type="button" className="w-full" onClick={() => setZoom(null)}>
            <img src={zoom} alt="" className="max-h-[70vh] w-full rounded object-contain" />
          </button>
        ) : loading ? (
          <p className="text-sm text-muted-foreground">Loading photos…</p>
        ) : photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">No photos available yet.</p>
        ) : (
          <div className="grid max-h-[70vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {photos.map((im) => (
              <button key={im.id} type="button" onClick={() => setZoom(im.url)} className="overflow-hidden rounded border border-border">
                <img src={im.url} alt={im.caption || ""} loading="lazy" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- product grid ---------------- */

export function BizadProductGridDialog({
  action, onClose, onBuy,
}: { action: LayerAction | null; onClose: () => void; onBuy: (product: any, size: string, qty: number) => void }) {
  const [detail, setDetail] = useState<any | null>(null);
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  useEffect(() => { setDetail(null); setSize(""); setQty(1); }, [action?.id]);
  if (!action) return null;
  const products = action.payload.products || [];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            {action.payload.productGridTitle || "Shop"}
          </DialogTitle>
          {!detail && (
            <DialogDescription>
              {products.length} product{products.length === 1 ? "" : "s"}
            </DialogDescription>
          )}
        </DialogHeader>

        {!detail && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {products.map((prod: any) => (
              <button
                key={prod.id}
                type="button"
                onClick={() => {
                  setDetail(prod);
                  setSize(prod.sizesEnabled && prod.sizes?.length ? prod.sizes[0] : "");
                  setQty(1);
                }}
                className="flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition hover:border-primary"
              >
                <div className="flex aspect-square items-center justify-center bg-muted">
                  {prod.imageUrl
                    ? <img src={prod.imageUrl} alt={prod.name} className="h-full w-full object-cover" />
                    : <Package className="h-8 w-8 text-muted-foreground" />}
                </div>
                <div className="p-2">
                  <div className="truncate text-sm font-medium">{prod.name || "Untitled"}</div>
                  {prod.price && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{prod.currency ? `${prod.currency} ` : ""}{prod.price}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {detail && (() => {
          const priceNum = Number(String(detail.price ?? "").replace(/[^0-9.]/g, "")) || 0;
          const cur = detail.currency ? `${detail.currency} ` : "";
          return (
            <div className="space-y-3">
              <button type="button" onClick={() => setDetail(null)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-3.5 w-3.5" /> Back to shop
              </button>
              {detail.imageUrl && <img src={detail.imageUrl} alt={detail.name} className="max-h-72 w-full rounded-md bg-muted object-contain" />}
              <div>
                <div className="text-lg font-semibold">{detail.name}</div>
                {detail.price && <div className="mt-1 text-base">{cur}{detail.price}</div>}
              </div>
              {detail.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{detail.description}</p>}
              {detail.sizesEnabled && detail.sizes?.length > 0 && (
                <div>
                  <Label className="text-xs">Size</Label>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {detail.sizes.map((s: string) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSize(s)}
                        className={`rounded border px-3 py-1.5 text-sm ${size === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted"}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Quantity</span>
                <div className="inline-flex items-center gap-2">
                  <button type="button" className="h-8 w-8 rounded-md border border-border disabled:opacity-50" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                  <span className="w-8 text-center text-sm">{qty}</span>
                  <button type="button" className="h-8 w-8 rounded-md border border-border" onClick={() => setQty((q) => Math.min(999, q + 1))}>+</button>
                </div>
              </div>
              {priceNum > 0 && (
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <span className="text-sm text-muted-foreground">Subtotal</span>
                  <span className="text-base font-semibold">{cur}{(priceNum * qty).toFixed(2)}</span>
                </div>
              )}
              <Button
                className="w-full"
                disabled={detail.sizesEnabled && detail.sizes?.length > 0 && !size}
                onClick={() => onBuy(detail, size, qty)}
              >
                Continue
              </Button>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- air messages ---------------- */

export function BizadAirMessages({
  action, onClose,
}: { action: LayerAction | null; onClose: () => void }) {
  const bubbles = action?.payload.bubbles || [];
  const stagger = action?.payload.bubbleStaggerMs ?? 900;
  const startDelay = action?.payload.bubbleStartDelayMs ?? 0;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (!action) return;
    setShown(0);
    const timers: number[] = [];
    bubbles.forEach((_, i) => {
      timers.push(window.setTimeout(() => setShown((n) => Math.max(n, i + 1)), startDelay + i * stagger));
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [action?.id]);

  if (!action || bubbles.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 p-4" onClick={onClose}>
      <div className="mx-auto flex w-full max-w-[420px] flex-col gap-3 pb-10">
        {bubbles.slice(0, shown).map((b) => (
          <AirBubble key={b.id} bubble={b} maxWidth={380} />
        ))}
      </div>
    </div>
  );
}

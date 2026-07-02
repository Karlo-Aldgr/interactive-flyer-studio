import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Mail,
  Link as LinkIcon,
  Copy,
  Check,
  X,
  ChevronDown,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  acceptUrlFor,
  createRealtorInvite,
  listRealtorInvites,
  revokeRealtorInvite,
  type RealtorInvite,
} from "@/lib/realtorInvites";

export function RealtorInvitesPanel() {
  const [open, setOpen] = useState(false);
  const [invites, setInvites] = useState<RealtorInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailForm, setEmailForm] = useState({ name: "", email: "", note: "" });
  const [busy, setBusy] = useState(false);
  const [justCreated, setJustCreated] = useState<{ url: string; email: string | null } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setInvites(await listRealtorInvites());
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load invites");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const pendingCount = invites.filter((i) => i.status === "pending").length;

  const submitEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.email.trim()) {
      toast.error("Email required");
      return;
    }
    setBusy(true);
    try {
      const { token } = await createRealtorInvite({
        email: emailForm.email,
        name: emailForm.name,
        note: emailForm.note,
      });
      const url = acceptUrlFor(token);
      setJustCreated({ url, email: emailForm.email });
      setEmailForm({ name: "", email: "", note: "" });
      toast.success("Invite created — share the accept link");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
    setBusy(false);
  };

  const generateShareLink = async () => {
    setBusy(true);
    try {
      const { token } = await createRealtorInvite({});
      const url = acceptUrlFor(token);
      setJustCreated({ url, email: null });
      toast.success("Shareable link generated");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
    setBusy(false);
  };

  const copy = async (id: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Link copied");
    setTimeout(() => setCopiedId(null), 1500);
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this invite? The link will no longer work.")) return;
    try {
      await revokeRealtorInvite(id);
      toast.success("Invite revoked");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  };

  const statusVariant = (s: RealtorInvite["status"]) =>
    s === "pending" ? "default" : s === "accepted" ? "secondary" : "destructive";

  return (
    <>
      <Collapsible open={open} onOpenChange={setOpen}>
        <Card className="overflow-hidden">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/40"
            >
              <div>
                <h2 className="font-semibold">Invite realtors</h2>
                <p className="text-sm text-muted-foreground">
                  Send an email invite or generate a shareable link that grants realtor access on accept.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {pendingCount > 0 && <Badge>{pendingCount} outstanding</Badge>}
                <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-6 border-t border-border px-5 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Email invite form */}
                <Card className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Invite by email</h3>
                  </div>
                  <form onSubmit={submitEmailInvite} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="inv_name">Name (optional)</Label>
                      <Input
                        id="inv_name"
                        value={emailForm.name}
                        onChange={(e) => setEmailForm((f) => ({ ...f, name: e.target.value }))}
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inv_email">Email *</Label>
                      <Input
                        id="inv_email"
                        type="email"
                        required
                        value={emailForm.email}
                        onChange={(e) => setEmailForm((f) => ({ ...f, email: e.target.value }))}
                        maxLength={255}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inv_note">Personal note (optional)</Label>
                      <Textarea
                        id="inv_note"
                        rows={2}
                        value={emailForm.note}
                        onChange={(e) => setEmailForm((f) => ({ ...f, note: e.target.value }))}
                        maxLength={500}
                      />
                    </div>
                    <Button type="submit" disabled={busy} className="w-full">
                      {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Create email invite
                    </Button>
                  </form>
                </Card>

                {/* Shareable link */}
                <Card className="p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <LinkIcon className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Shareable link</h3>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    Generate a one-time link you can send via SMS, WhatsApp, DM, or any channel. The first
                    person to sign up and accept it becomes a realtor.
                  </p>
                  <Button onClick={generateShareLink} disabled={busy} variant="secondary" className="w-full">
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                    Generate shareable link
                  </Button>
                </Card>
              </div>

              {/* Outstanding invites list */}
              <div>
                <h3 className="mb-2 font-semibold">Outstanding & recent invites</h3>
                {loading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : invites.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                    No invites yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {invites.map((inv) => {
                      const url = acceptUrlFor(inv.token);
                      const expired = inv.status === "pending" && new Date(inv.expires_at) < new Date();
                      return (
                        <Card key={inv.id} className="p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="gap-1">
                                  {inv.email ? <Mail className="h-3 w-3" /> : <LinkIcon className="h-3 w-3" />}
                                  {inv.email ? "Email" : "Link"}
                                </Badge>
                                <Badge variant={statusVariant(expired ? "expired" : inv.status)}>
                                  {expired ? "expired" : inv.status}
                                </Badge>
                                {inv.email && <span className="font-medium">{inv.email}</span>}
                                {inv.invited_name && (
                                  <span className="text-muted-foreground">({inv.invited_name})</span>
                                )}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {url}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Created {format(new Date(inv.created_at), "PP p")} · Expires{" "}
                                {format(new Date(inv.expires_at), "PP")}
                              </div>
                              {inv.note && (
                                <p className="border-l-2 border-border pl-2 text-xs text-muted-foreground">
                                  {inv.note}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => copy(inv.id, url)}>
                                {copiedId === inv.id ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                <span className="ml-1">Copy link</span>
                              </Button>
                              {inv.status === "pending" && !expired && (
                                <Button size="sm" variant="ghost" onClick={() => revoke(inv.id)}>
                                  <X className="h-3.5 w-3.5" />
                                  <span className="ml-1">Revoke</span>
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Created dialog with copy link */}
      <Dialog open={!!justCreated} onOpenChange={(o) => !o && setJustCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite created</DialogTitle>
            <DialogDescription>
              {justCreated?.email
                ? `Share this link with ${justCreated.email}. Email delivery activates once your email domain is set up — for now, send it manually.`
                : "Share this link anywhere. The first person to sign up and accept becomes a realtor."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm break-all">
            {justCreated?.url}
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (justCreated) {
                  await navigator.clipboard.writeText(justCreated.url);
                  toast.success("Link copied");
                }
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

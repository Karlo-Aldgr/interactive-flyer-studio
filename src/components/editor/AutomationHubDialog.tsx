import type { Flyer } from "@/types/flyer";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle2, Clock3, Instagram, PlusCircle, Rocket, Sparkles, ShieldCheck } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flyer: Flyer;
  onOpenMarketing: () => void;
  onOpenAutoPilot: () => void;
  onOpenCoach: () => void;
  onOpenFacebookPost: () => void;
  onOpenInstagramPost: () => void;
}

function AutomationCard({
  title,
  description,
  badge,
  statusText,
  requirements,
  actionLabel,
  actionDisabled = false,
  onAction,
  icon,
}: {
  title: string;
  description: string;
  badge: string;
  statusText: string;
  requirements: string[];
  actionLabel: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
          <Badge variant={badge === "Ready now" ? "secondary" : "outline"}>{badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">{statusText}</div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">Required setup</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {requirements.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
        <Button type="button" size="sm" onClick={onAction} disabled={actionDisabled}>
          {actionLabel}
        </Button>
      </CardContent>
    </Card>
  );
}

export function AutomationHubDialog({
  open,
  onOpenChange,
  flyer,
  onOpenMarketing,
  onOpenAutoPilot,
  onOpenCoach,
  onOpenFacebookPost,
  onOpenInstagramPost,
}: Props) {
  // Closing this Dialog and opening another in the same tick often drops the second modal (Radix).
  function openAfterClose(next: () => void) {
    onOpenChange(false);
    window.setTimeout(next, 50);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-primary" />
            Add Automations
          </DialogTitle>
          <DialogDescription>
            Choose which automation tools this flyer should use. The current build keeps everything inside TapThatFlyer first, so we can grow into the broader AI marketing platform without redoing the structure later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Flyer:</span> {flyer.title}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <AutomationCard
              title="AutoPilot Marketing"
              description="One place to check channels and hit START — Facebook, Instagram, and email drafts, along with analytics."
              badge="Ready now"
              statusText="Phase 5 shell: live channels + AI chatbot on published flyers; agency white-label later."
              requirements={[
                "Flyer must be published",
                "OPENAI_API_KEY for AI copy",
                "Meta connected for real social Post Now",
              ]}
              actionLabel="Open AutoPilot"
              onAction={() => openAfterClose(onOpenAutoPilot)}
              icon={<Rocket className="h-4 w-4" />}
            />

            <AutomationCard
              title="AI Social Copy"
              description="Generate Facebook, Instagram, and email draft copy, then schedule social auto-post or mark posted."
              badge="Ready now"
              statusText="Phase 1–2 Meta + Phase 4 email draft (copy/paste). Facebook/Instagram auto-post in Meta test mode."
              requirements={[
                "Flyer must be published (public thumbnail + link)",
                "OPENAI_API_KEY secret (or n8n fallback)",
                "Meta connected for real Post Now / schedule send",
              ]}
              actionLabel="Open AI posts"
              onAction={() => openAfterClose(onOpenMarketing)}
              icon={<Sparkles className="h-4 w-4" />}
            />

            <AutomationCard
              title="AI Marketing Coach"
              description="Score headline, CTA, readability, and conversion likelihood — with fix tips before you promote."
              badge="Ready now"
              statusText="PDF roadmap #1 MVP: uses flyer text layers + interactive actions (image-only copy is limited)."
              requirements={[
                "Signed-in owner/editor",
                "OPENAI_API_KEY on flyer-coach",
                "Works on draft or published flyers",
              ]}
              actionLabel="Open coach"
              onAction={() => openAfterClose(onOpenCoach)}
              icon={<Sparkles className="h-4 w-4" />}
            />

            <AutomationCard
              title="Facebook Post Now"
              description="Connect your Facebook Page with OAuth and send the latest AI Facebook copy."
              badge="Ready to test"
              statusText="Works in Meta test mode (app roles/testers). Live customers need Meta App Review — see docs/meta-app-review.md."
              requirements={[
                "Facebook Page you admin",
                "Connect with Facebook (OAuth)",
                "META_APP_ID / META_APP_SECRET configured",
              ]}
              actionLabel="Open Facebook post"
              onAction={() => openAfterClose(onOpenFacebookPost)}
              icon={<Bot className="h-4 w-4" />}
            />

            <AutomationCard
              title="Instagram Post Now"
              description="Post the latest AI Instagram caption to your Instagram Business/Creator account."
              badge="Ready to test"
              statusText="Works in test mode with staff IG token. Public IG for all customers needs App Review + later per-user IG OAuth."
              requirements={[
                "Instagram Business or Creator account",
                "Instagram User ID saved + Extend Instagram token",
                "Public flyer thumbnail JPEG URL",
              ]}
              actionLabel="Open Instagram post"
              onAction={() => openAfterClose(onOpenInstagramPost)}
              icon={<Instagram className="h-4 w-4" />}
            />

            <AutomationCard
              title="Meta App Review"
              description="Checklist to move Facebook Page posting from testers-only to Live for real customers."
              badge="Operator guide"
              statusText="Code is ready in test mode. Submit pages_show_list, pages_read_engagement, pages_manage_posts + screencast. Full steps in docs/meta-app-review.md."
              requirements={[
                "Privacy Policy + Terms URLs on a public site",
                "Screencast: Connect Facebook → Post Now",
                "App Review in Meta Developer Console",
              ]}
              actionLabel="Guide in repo docs"
              actionDisabled
              icon={<ShieldCheck className="h-4 w-4" />}
            />

            <AutomationCard
              title="Automation Framework"
              description="This flyer-level hub is the foundation for future automations like audience tools and agency white-label."
              badge="Foundation"
              statusText="Phases 1–5 + Coach + email send. SMS awaits Twilio account. Meta Live needs App Review."
              requirements={[
                "Per-flyer automation entry point",
                "Portal Suggestions + AutoPilot status strip",
                "AI Marketing Coach + Resend email send",
              ]}
              actionLabel="Framework active"
              actionDisabled
              icon={<CheckCircle2 className="h-4 w-4" />}
            />          </div>

          <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
            <div className="mb-1 flex items-center gap-2 text-foreground">
              <Clock3 className="h-4 w-4 text-primary" />
              Local-first reminder
            </div>
            Nothing in this automation hub changes the live site until you decide to merge and publish later.
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import type { Flyer } from "@/types/flyer";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle2, Clock3, Instagram, PlusCircle, Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flyer: Flyer;
  onOpenMarketing: () => void;
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

export function AutomationHubDialog({ open, onOpenChange, flyer, onOpenMarketing }: Props) {
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
              title="AI Social Copy"
              description="Generate Facebook and Instagram copy, then schedule or mark it posted inside the app."
              badge="Ready now"
              statusText="This is the existing Phase 1 + 2 marketing module."
              requirements={[
                "Flyer must be published",
                "n8n + OpenAI must stay connected",
                "No social account linking required yet",
              ]}
              actionLabel="Open AI posts"
              onAction={() => {
                onOpenChange(false);
                onOpenMarketing();
              }}
              icon={<Sparkles className="h-4 w-4" />}
            />

            <AutomationCard
              title="Facebook Post Now"
              description="Future direct posting to a connected Facebook business page."
              badge="Next"
              statusText="Phase 2B: not wired yet. Use this module as the future entry point for real posting."
              requirements={[
                "Facebook business page",
                "Meta Business Suite setup",
                "Connected Meta app / account auth",
              ]}
              actionLabel="Coming next"
              actionDisabled
              icon={<Bot className="h-4 w-4" />}
            />

            <AutomationCard
              title="Instagram Post Now"
              description="Future direct posting to a connected Instagram business or creator account."
              badge="Next"
              statusText="Phase 2B: not wired yet. This stays separate from AI copy so account connection can be handled cleanly."
              requirements={[
                "Instagram Business or Creator account",
                "Connected Facebook page / Meta Business Suite",
                "Connected Meta app / account auth",
              ]}
              actionLabel="Coming next"
              actionDisabled
              icon={<Instagram className="h-4 w-4" />}
            />

            <AutomationCard
              title="Automation Framework"
              description="This flyer-level hub is the foundation for future automations like TikTok, email, SMS, AI coach, and audience tools."
              badge="Foundation"
              statusText="Framework v1 is local-only right now so structure can be refined before anything goes live."
              requirements={[
                "Per-flyer automation entry point",
                "Per-automation setup requirements",
                "Future account linking modules",
              ]}
              actionLabel="Framework active"
              actionDisabled
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </div>

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

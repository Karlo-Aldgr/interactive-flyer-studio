import { forwardRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart3, Briefcase, ChevronDown, ClipboardList, Crosshair, DollarSign, Eye, IdCard, Inbox,
  Link as LinkIcon, Monitor, MoreHorizontal, Music, Music2, PartyPopper,
  Share2, Smartphone, Sparkles, Tablet, Timer, Users, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DeviceFrame } from "@/store/editorStore";
import type { Flyer } from "@/types/flyer";
import { hasAnySocial } from "@/components/viewer/SocialSlideout";
import { cn } from "@/lib/utils";
import { getBizadForFlyer } from "@/lib/bizad";
import { getJobIdForFlyer } from "@/lib/onboarding";
import { format } from "date-fns";

export interface TopBarMenuActions {
  flyer: Flyer;
  flyerId: string;
  showHitboxes: boolean;
  deviceFrame: DeviceFrame;
  onToggleHitboxes: () => void;
  onSetDeviceFrame: (f: DeviceFrame) => void;
  onToggleHighlights: () => void;
  onOpenCategory: () => void;
  onOpenSubscribers: () => void;
  onOpenPortalLink: () => void;
  onOpenBizad: () => void;
  onOpenIntroAudio: () => void;
  onOpenBgAudio: () => void;
  onOpenAutoAdvance: () => void;
  onOpenSocial: () => void;
  onOpenCheckout: () => void;
  onOpenPayLink: () => void;
  onOpenShare: () => void;
  onOpenMarketing: () => void;
  onOpenResize: () => void;
}

function ActiveDot({ active, className }: { active?: boolean; className?: string }) {
  if (!active) return null;
  return <span className={cn("inline-block h-1.5 w-1.5 rounded-full bg-primary", className)} />;
}

/** Onboarding is per project — link to this flyer's own onboarding. */
function useOnboardingHref(flyerId: string) {
  const [href, setHref] = useState("/onboarding");
  useEffect(() => {
    let alive = true;
    getJobIdForFlyer(flyerId)
      .then((jobId) => {
        if (alive && jobId) setHref(`/onboarding?job=${jobId}`);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [flyerId]);
  return href;
}

const MENU_CONTENT_CLASS = "z-[200] w-52";

const MenuTrigger = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<typeof Button> & { label: string; active?: boolean }
>(({ label, active, className, ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    variant="outline"
    size="sm"
    className={cn("h-8 gap-1 px-2.5", className)}
    {...props}
  >
    {label}
    <ActiveDot active={active} className="ml-1" />
    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
  </Button>
));
MenuTrigger.displayName = "MenuTrigger";

export function TopBarViewMenu({
  flyer,
  showHitboxes,
  deviceFrame,
  onToggleHitboxes,
  onSetDeviceFrame,
  onToggleHighlights,
}: Pick<TopBarMenuActions, "flyer" | "showHitboxes" | "deviceFrame" | "onToggleHitboxes" | "onSetDeviceFrame" | "onToggleHighlights">) {
  const highlightsOn = flyer.settings.highlightsEnabled ?? true;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1 px-2.5">
          View
          <ActiveDot active={showHitboxes || !highlightsOn || deviceFrame !== "desktop"} />
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={MENU_CONTENT_CLASS}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Device preview</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={deviceFrame} onValueChange={(v) => onSetDeviceFrame(v as DeviceFrame)}>
          <DropdownMenuRadioItem value="desktop">
            <Monitor className="mr-2 h-4 w-4" /> Desktop
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="tablet">
            <Tablet className="mr-2 h-4 w-4" /> Tablet
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="mobile">
            <Smartphone className="mr-2 h-4 w-4" /> Mobile
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={showHitboxes}
          onSelect={(e) => {
            e.preventDefault();
            onToggleHitboxes();
          }}
        >
          <Crosshair className="mr-2 h-4 w-4" /> Show hitboxes
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={highlightsOn}
          onSelect={(e) => {
            e.preventDefault();
            onToggleHighlights();
          }}
        >
          <Sparkles className="mr-2 h-4 w-4" /> Tap highlights
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBarPortalMenu({
  flyerId,
  onOpenSubscribers,
  onOpenPortalLink,
  onOpenBizad,
}: Pick<TopBarMenuActions, "flyerId" | "onOpenSubscribers" | "onOpenPortalLink" | "onOpenBizad">) {
  const onboardingHref = useOnboardingHref(flyerId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTrigger label="Portal" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
        <DropdownMenuItem asChild>
          <Link to={`/flyer/${flyerId}/portal`} className="flex cursor-pointer items-center">
            <Inbox className="mr-2 h-4 w-4" /> Open portal
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenPortalLink}>
          <LinkIcon className="mr-2 h-4 w-4" /> Portal link
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenBizad}>
          <IdCard className="mr-2 h-4 w-4" /> Digital business card
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/analytics/${flyerId}`} className="flex cursor-pointer items-center">
            <BarChart3 className="mr-2 h-4 w-4" /> Results
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenSubscribers}>
          <Users className="mr-2 h-4 w-4" /> Subscribers
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={onboardingHref} className="flex cursor-pointer items-center">
            <ClipboardList className="mr-2 h-4 w-4" /> Onboarding
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard/social" className="flex cursor-pointer items-center">
            <ClipboardList className="mr-2 h-4 w-4" /> Social Media Manager
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBarMediaMenu({
  flyer,
  onOpenIntroAudio,
  onOpenBgAudio,
  onOpenAutoAdvance,
  onOpenSocial,
}: Pick<TopBarMenuActions, "flyer" | "onOpenIntroAudio" | "onOpenBgAudio" | "onOpenAutoAdvance" | "onOpenSocial">) {
  const active =
    !!flyer.settings.introAudioUrl ||
    !!flyer.settings.bgAudioUrl ||
    !!(flyer.settings as any)?.autoAdvanceEnabled ||
    hasAnySocial(flyer.settings.social);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTrigger label="Media" active={active} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
        <DropdownMenuItem onSelect={onOpenIntroAudio}>
          <Music className="mr-2 h-4 w-4" /> Intro audio
          {flyer.settings.introAudioUrl && <ActiveDot active className="ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenBgAudio}>
          <Music2 className="mr-2 h-4 w-4" /> Background audio
          {flyer.settings.bgAudioUrl && <ActiveDot active className="ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenAutoAdvance}>
          <Timer className="mr-2 h-4 w-4" /> Auto-advance
          {(flyer.settings as any)?.autoAdvanceEnabled && <ActiveDot active className="ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenSocial}>
          <Share2 className="mr-2 h-4 w-4" /> Social links
          {hasAnySocial(flyer.settings.social) && <ActiveDot active className="ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBarPaymentsMenu({
  flyer,
  onOpenCheckout,
  onOpenPayLink,
}: Pick<TopBarMenuActions, "flyer" | "onOpenCheckout" | "onOpenPayLink">) {
  const active = !!(flyer.settings.payVenmo || flyer.settings.payCashapp || flyer.settings.payApplePayContact);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <MenuTrigger label="Payments" active={active} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
        <DropdownMenuItem onSelect={onOpenCheckout}>
          <Wallet className="mr-2 h-4 w-4" /> Checkout settings
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onOpenPayLink}>
          <DollarSign className="mr-2 h-4 w-4" /> Pay link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBarFlyerMenu({
  flyer,
  onOpenCategory,
}: Pick<TopBarMenuActions, "flyer" | "onOpenCategory">) {
  const isEvent = (flyer as any).category === "event";
  const eventLabel = isEvent && (flyer as any).event_date
    ? format(new Date(((flyer as any).event_date as string) + "T00:00:00"), "MMM d")
    : isEvent ? "Event" : "Business";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={isEvent ? "secondary" : "outline"}
          className="h-8 gap-1 px-2.5"
        >
          {isEvent ? <PartyPopper className="h-3.5 w-3.5" /> : <Briefcase className="h-3.5 w-3.5" />}
          {eventLabel}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={MENU_CONTENT_CLASS}>
        <DropdownMenuItem onSelect={onOpenCategory}>
          {isEvent ? <PartyPopper className="mr-2 h-4 w-4" /> : <Briefcase className="mr-2 h-4 w-4" />}
          Change category…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBarMobileMenu(actions: TopBarMenuActions) {
  const { flyer, flyerId } = actions;
  const onboardingHref = useOnboardingHref(flyerId);
  const highlightsOn = flyer.settings.highlightsEnabled ?? true;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-8 w-8 shrink-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn(MENU_CONTENT_CLASS, "max-h-[min(70vh,28rem)] w-56 overflow-y-auto")}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">View</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={actions.deviceFrame} onValueChange={(v) => actions.onSetDeviceFrame(v as DeviceFrame)}>
          <DropdownMenuRadioItem value="desktop"><Monitor className="mr-2 h-4 w-4" /> Desktop</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="tablet"><Tablet className="mr-2 h-4 w-4" /> Tablet</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="mobile"><Smartphone className="mr-2 h-4 w-4" /> Mobile</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuCheckboxItem
          checked={actions.showHitboxes}
          onSelect={(e) => {
            e.preventDefault();
            actions.onToggleHitboxes();
          }}
        >
          <Crosshair className="mr-2 h-4 w-4" /> Show hitboxes
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={highlightsOn}
          onSelect={(e) => {
            e.preventDefault();
            actions.onToggleHighlights();
          }}
        >
          <Sparkles className="mr-2 h-4 w-4" /> Tap highlights
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Flyer</DropdownMenuLabel>
        <DropdownMenuItem onSelect={actions.onOpenCategory}>
          <Briefcase className="mr-2 h-4 w-4" /> Category
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onOpenResize}>
          Canvas size
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Portal</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to={`/flyer/${flyerId}/portal`} className="flex cursor-pointer items-center">
            <Inbox className="mr-2 h-4 w-4" /> Portal
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onOpenPortalLink}>
          <LinkIcon className="mr-2 h-4 w-4" /> Portal link
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onOpenBizad}>
          <IdCard className="mr-2 h-4 w-4" /> Digital business card
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/analytics/${flyerId}`} className="flex cursor-pointer items-center">
            <BarChart3 className="mr-2 h-4 w-4" /> Results
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onOpenSubscribers}>
          <Users className="mr-2 h-4 w-4" /> Subscribers
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={onboardingHref} className="flex cursor-pointer items-center">
            <ClipboardList className="mr-2 h-4 w-4" /> Onboarding
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/dashboard/social" className="flex cursor-pointer items-center">
            <ClipboardList className="mr-2 h-4 w-4" /> Social Media Manager
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Media</DropdownMenuLabel>
        <DropdownMenuItem onSelect={actions.onOpenIntroAudio}><Music className="mr-2 h-4 w-4" /> Intro audio</DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onOpenBgAudio}><Music2 className="mr-2 h-4 w-4" /> Background audio</DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onOpenAutoAdvance}><Timer className="mr-2 h-4 w-4" /> Auto-advance</DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onOpenSocial}><Share2 className="mr-2 h-4 w-4" /> Social</DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Payments</DropdownMenuLabel>
        <DropdownMenuItem onSelect={actions.onOpenCheckout}><Wallet className="mr-2 h-4 w-4" /> Checkout</DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onOpenPayLink}><DollarSign className="mr-2 h-4 w-4" /> Pay link</DropdownMenuItem>

        {flyer.status === "published" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={actions.onOpenShare}>
              <Share2 className="mr-2 h-4 w-4" /> Share
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={actions.onOpenMarketing}>
              <Sparkles className="mr-2 h-4 w-4" /> Add automations
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TopBarPreviewButton({ flyerId, compact }: { flyerId: string; compact?: boolean }) {
  const [bizadSlug, setBizadSlug] = useState<string | null>(null);
  const [bizadEnabled, setBizadEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await getBizadForFlyer(flyerId);
        if (cancelled) return;
        setBizadSlug(b?.slug ?? null);
        setBizadEnabled(!!b?.enabled);
      } catch {
        /* no card yet */
      }
    })();
    return () => { cancelled = true; };
  }, [flyerId]);

  const trigger = compact ? (
    <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" title="Preview">
      <Eye className="h-4 w-4" />
    </Button>
  ) : (
    <Button size="sm" variant="outline" className="h-8">
      <Eye className="mr-1 h-4 w-4" /> Preview
      <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
    </Button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Preview</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <a href={`/preview/${flyerId}`} target="_blank" rel="noreferrer">
            <Eye className="mr-2 h-4 w-4" /> Flyer (private preview)
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {bizadSlug ? (
          <DropdownMenuItem asChild>
            <a href={`/bizads/${bizadSlug}`} target="_blank" rel="noreferrer">
              <IdCard className="mr-2 h-4 w-4" />
              <span className="flex-1">Digital business card</span>
              {!bizadEnabled && <span className="ml-2 text-[10px] text-muted-foreground">off</span>}
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <IdCard className="mr-2 h-4 w-4" /> No digital business card yet
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


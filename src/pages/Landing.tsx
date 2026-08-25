// Homepage hero — single composition matching client reference layout.
import { Link } from "react-router-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Upload,
  Wand2,
  ArrowRight,
  QrCode,
  Play,
  Phone,
  Calendar,
  Globe,
  MapPin,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { INTERACTIONS, InteractionDef } from "@/lib/interactionsCatalog";
import Reveal from "@/components/landing/Reveal";
import { NewsletterSignup } from "@/components/landing/NewsletterSignup";
import { cn } from "@/lib/utils";

const DEMO_VIDEO = "/interaction.mp4";

const FEATURES = [
  { icon: QrCode, label: "Scan Instantly" },
  { icon: Play, label: "Watch Videos" },
  { icon: Phone, label: "Call With One Tap" },
  { icon: Calendar, label: "Book Appointments" },
  { icon: Globe, label: "Visit Websites" },
  { icon: MapPin, label: "Get Directions" },
] as const;

/** Reference fan: tucked toward person so side captions stay clear */
const TRADITIONAL = [
  { src: "/landing/trad-laundry.png", alt: "Traditional laundry flyer", rotate: "-11deg", x: "18%", y: "2%", z: 3 },
  { src: "/landing/trad-pizza.png", alt: "Traditional pizza flyer", rotate: "7deg", x: "38%", y: "28%", z: 5 },
  { src: "/landing/trad-homeware.png", alt: "Traditional homeware flyer", rotate: "-6deg", x: "14%", y: "54%", z: 4 },
] as const;

const DIGITAL = [
  { src: "/landing/digital-realty.png", alt: "Interactive real estate flyer", rotate: "10deg", x: "10%", y: "2%", z: 3 },
  { src: "/landing/digital-fishhouse.png", alt: "Interactive fish house menu", rotate: "-8deg", x: "0%", y: "28%", z: 5 },
  { src: "/landing/digital-guardian.png", alt: "Interactive apparel flyer", rotate: "6deg", x: "14%", y: "54%", z: 4 },
] as const;

const UPDATES = [
  {
    title: "Social posting automations",
    body: "Connect a Facebook Page and publish flyer posts without leaving Tap That Flyer — built for real customer Pages once Meta Live access is ready.",
  },
  {
    title: "Hosted business pages",
    body: "Draft a simple public business page from onboarding. Staff publishes when it’s ready — a clean /b link for customers who need a web presence.",
  },
  {
    title: "Smarter flyer experiences",
    body: "Interactive hotspots, Ask AI from your business description, realtor tools, and more — so every flyer does more than look good.",
  },
] as const;

function StageFlyer({
  src,
  alt,
  rotate,
  muted,
  badge,
  badgeSide,
  x,
  y,
  z,
}: {
  src: string;
  alt: string;
  rotate: string;
  muted?: boolean;
  badge: "x" | "check";
  badgeSide: "left" | "right";
  x: string;
  y: string;
  z: number;
}) {
  return (
    <button
      type="button"
      aria-label={alt}
      className="group absolute w-[86%] max-w-[118px] origin-center cursor-pointer border-0 bg-transparent p-0 sm:max-w-[150px] md:max-w-[165px] lg:max-w-[178px]"
      style={{ left: x, top: y, zIndex: z }}
    >
      <span
        className="relative block transition-transform duration-300 ease-out group-hover:z-50 group-hover:-translate-y-1.5 group-hover:scale-[1.07]"
        style={{ transform: `rotate(${rotate})` }}
      >
        <span className="block overflow-hidden rounded-[2px] shadow-[0_8px_20px_-4px_rgba(15,40,80,0.3)] transition duration-300 group-hover:shadow-[0_14px_28px_-6px_rgba(15,40,80,0.4)]">
          <img
            src={src}
            alt=""
            draggable={false}
            loading="lazy"
            className={cn(
              "aspect-[3/4] w-full object-cover transition duration-500 group-hover:scale-[1.03]",
              muted && "grayscale contrast-[0.9] brightness-[0.95]",
            )}
          />
        </span>
        <span
          className={cn(
            "absolute top-[10%] flex h-5 w-5 items-center justify-center rounded-full text-white shadow-md transition duration-300 group-hover:scale-110 sm:h-6 sm:w-6 md:h-7 md:w-7",
            badgeSide === "left" ? "-left-2 sm:-left-2.5 md:-left-3" : "-right-2 sm:-right-2.5 md:-right-3",
            badge === "x" ? "bg-[#e53935]" : "bg-[#1e9fff]",
          )}
        >
          {badge === "x" ? <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={3} /> : <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={3} />}
        </span>
      </span>
    </button>
  );
}

function SideCaption({
  side,
  children,
}: {
  side: "left" | "right";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none relative z-20 hidden w-[6.75rem] shrink-0 self-center lg:block xl:w-[8.25rem]",
        side === "left" ? "mr-1 text-left xl:mr-2" : "ml-1 text-right xl:ml-2",
      )}
    >
      <p className="text-[10px] font-bold leading-snug text-[#0a1f44] xl:text-xs">{children}</p>
      <svg
        viewBox="0 0 80 40"
        className={cn("mt-1 h-7 w-14 text-[#0a1f44]/70 xl:h-8 xl:w-16", side === "right" && "ml-auto scale-x-[-1]")}
        fill="none"
        aria-hidden
      >
        <path
          d="M8 28 C 28 28, 40 8, 72 10"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
        <path d="M66 6 L74 10 L66 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function Landing() {
  const { user } = useAuth();
  const [active, setActive] = useState<InteractionDef | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [videoOpacity, setVideoOpacity] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const startHref = user ? "/submit-job" : "/auth?next=/submit-job";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (videoOpen) {
      setVideoOpacity(0);
      const id = requestAnimationFrame(() => setVideoOpacity(1));
      void video.play().catch(() => undefined);
      return () => cancelAnimationFrame(id);
    }
    setVideoOpacity(0);
    video.pause();
  }, [videoOpen]);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#f4f6f8] text-[#0a1f44]">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#f4f6f8]/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="group">
            <img src={logo} alt="Tap That Flyer" className="h-9 w-auto transition group-hover:scale-105 sm:h-10" />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-[#5a6a80] md:flex">
            {[
              ["#compare", "Why interactive"],
              ["#updates", "What’s new"],
              ["#interactions", "Interactions"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="transition hover:text-[#1e9fff]">
                {label}
              </a>
            ))}
            <Link to="/examples" className="transition hover:text-[#1e9fff]">
              Examples
            </Link>
          </nav>
          <Button asChild className="bg-[#ff8a00] font-bold text-white hover:bg-[#e67a00]">
            <Link to={user ? "/dashboard" : "/auth"}>{user ? "Dashboard" : "Get started"}</Link>
          </Button>
        </div>
      </header>

      {/* —— HERO + REFERENCE COMPOSITION —— */}
      <section className="relative z-10 pt-6 md:pt-8">
        <div className="container text-center">
          <Reveal>
            <img src={logo} alt="Tap That Flyer" className="mx-auto h-auto w-full max-w-[240px] sm:max-w-[300px] md:max-w-[360px]" />
          </Reveal>
          <Reveal delay={60}>
            <h1 className="mt-3 font-display text-[clamp(1.75rem,5.2vw,3.5rem)] font-extrabold uppercase leading-[1.05] tracking-tight">
              <span className="text-[#0a1f44]">Are your </span>
              <span className="text-[#1e9fff]">flyers</span>
              <br />
              <span className="text-[#ff8a00]">getting ignored?</span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-[#3d4d63] sm:text-base md:text-lg">
              People don&apos;t ignore what they can{" "}
              <span className="font-bold text-[#1e9fff]">see, tap, and interact</span> with.
            </p>
          </Reveal>
        </div>

        <div id="compare" className="relative mx-auto mt-2 w-full max-w-6xl px-1 sm:mt-3 sm:px-3 md:px-4">
          {/* Captions on small/medium — side captions only on large */}
          <div className="mb-1 flex justify-between gap-2 px-2 text-[9px] font-bold leading-snug sm:mb-2 sm:text-[10px] lg:hidden">
            <p className="max-w-[48%]">
              Traditional Flyers <span className="text-[#ff8a00]">Get Seen.</span> Then Ignored.
            </p>
            <p className="max-w-[48%] text-right">
              Interactive Flyers <span className="text-[#1e9fff]">Get Attention.</span> Get Results.
            </p>
          </div>

          {/* Same structure every breakpoint: left flyers | person | right flyers */}
          <div className="relative flex items-end justify-center">
            <SideCaption side="left">
              Traditional Flyers <span className="text-[#ff8a00]">Get Seen.</span> Then Ignored.
            </SideCaption>

            <div className="relative z-[1] mb-[10%] -mr-8 h-[200px] w-[108px] shrink-0 sm:mb-[12%] sm:-mr-12 sm:h-[300px] sm:w-[168px] md:-mr-14 md:h-[360px] md:w-[200px] lg:h-[410px] lg:w-[230px]">
              {TRADITIONAL.map((f) => (
                <StageFlyer
                  key={f.src}
                  src={f.src}
                  alt={f.alt}
                  rotate={f.rotate}
                  muted
                  badge="x"
                  badgeSide="left"
                  x={f.x}
                  y={f.y}
                  z={f.z}
                />
              ))}
            </div>

            <div className="relative z-10 -mb-1 w-[min(68vw,340px)] shrink-0 sm:-mb-2 sm:w-[min(50vw,480px)] md:w-[min(46vw,540px)] lg:w-[min(44vw,580px)]">
              <button
                type="button"
                onClick={() => setVideoOpen((v) => !v)}
                className="relative block w-full cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e9fff]"
                aria-label={videoOpen ? "Hide demo video" : "Play demo video"}
              >
                <img
                  src="/landing/hero-person.png?v=23"
                  alt="Person using Tap That Flyer on a phone"
                  draggable={false}
                  className="pointer-events-none mx-auto h-auto w-full scale-[1.08] object-contain object-bottom transition duration-300 hover:scale-[1.1] sm:scale-[1.1] sm:hover:scale-[1.12]"
                />
              </button>

              <div className="pointer-events-none absolute bottom-[11%] left-1/2 z-20 w-[94%] -translate-x-1/2 sm:bottom-[13%] sm:w-[90%] md:bottom-[14%]">
                <div className="bg-[#0a1f44]/90 px-2 py-1.5 text-center sm:px-4 sm:py-2.5">
                  <div className="border-y-2 border-[#ff8a00] py-1 sm:py-2">
                    <p className="text-[7px] font-semibold uppercase tracking-[0.16em] text-white sm:text-[10px] sm:tracking-[0.22em]">
                      Turn ordinary print
                    </p>
                    <p className="font-display text-[clamp(0.9rem,4.2vw,1.95rem)] font-extrabold uppercase leading-[1.05] tracking-tight text-[#1e9fff]">
                      Into extraordinary
                    </p>
                    <p className="mt-0.5 text-[7px] font-semibold uppercase tracking-[0.16em] text-white sm:text-[10px] sm:tracking-[0.22em]">
                      Experiences.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "absolute left-1/2 top-[5%] z-30 w-[82%] -translate-x-1/2 overflow-hidden rounded-lg border border-white/40 bg-black shadow-2xl transition-opacity duration-700 sm:w-[78%] sm:rounded-xl",
                  videoOpen ? "pointer-events-auto" : "pointer-events-none",
                )}
                style={{ opacity: videoOpacity, bottom: "22%" }}
              >
                <video
                  ref={videoRef}
                  src={DEMO_VIDEO}
                  className="h-full w-full object-cover"
                  playsInline
                  loop
                  muted
                  controls={videoOpen}
                />
                {videoOpen && (
                  <button
                    type="button"
                    onClick={() => setVideoOpen(false)}
                    className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold uppercase text-white"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>

            <div className="relative z-[1] mb-[10%] -ml-8 h-[200px] w-[108px] shrink-0 sm:mb-[12%] sm:-ml-12 sm:h-[300px] sm:w-[168px] md:-ml-14 md:h-[360px] md:w-[200px] lg:h-[410px] lg:w-[230px]">
              {DIGITAL.map((f) => (
                <StageFlyer
                  key={f.src}
                  src={f.src}
                  alt={f.alt}
                  rotate={f.rotate}
                  badge="check"
                  badgeSide="right"
                  x={f.x}
                  y={f.y}
                  z={f.z}
                />
              ))}
            </div>

            <SideCaption side="right">
              Interactive Flyers <span className="text-[#1e9fff]">Get Attention.</span> Get Results.
            </SideCaption>
          </div>

          {/* Feature bar — 3x2 on mobile, row on desktop */}
          <div className="relative z-20 mx-auto mt-3 max-w-4xl px-1 sm:-mt-3 sm:px-2 md:-mt-5">
            <div className="grid grid-cols-3 gap-y-3 rounded-2xl border border-[#e8eef5] bg-white px-2 py-3 shadow-[0_8px_30px_-10px_rgba(15,40,80,0.18)] sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-3 sm:gap-y-2 sm:px-5 sm:py-4">
              {FEATURES.map(({ icon: Icon, label }, i) => (
                <div key={label} className="flex items-center justify-center sm:contents">
                  {i > 0 && <span className="mr-3 hidden h-8 w-px bg-[#d7e0ea] sm:block" />}
                  <button
                    type="button"
                    className="group flex w-full flex-col items-center gap-1 rounded-lg px-1 py-1 transition hover:-translate-y-0.5 sm:w-auto sm:min-w-[6.25rem]"
                  >
                    <span className="flex h-7 w-7 items-center justify-center text-[#1e9fff] transition group-hover:scale-110 sm:h-9 sm:w-9">
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" strokeWidth={2.2} />
                    </span>
                    <span className="text-center text-[7px] font-bold uppercase leading-tight tracking-wide text-[#0a1f44] sm:text-[10px]">
                      {label}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTAs */}
      <section className="container px-4 py-8 text-center md:py-10">
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button asChild size="lg" className="w-full bg-[#ff8a00] font-bold text-white hover:bg-[#e67a00] hover:scale-[1.03] sm:w-auto">
            <Link to={startHref}>
              Let&apos;s make your marketing impossible to ignore
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full border-[#0a1f44] font-semibold hover:scale-[1.03] sm:w-auto">
            <a href="#updates">See what we&apos;re building</a>
          </Button>
        </div>
      </section>

      <section id="updates" className="bg-[#0a1f44] py-16 text-white md:py-20">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#ff8a00]">
              <Sparkles className="h-3.5 w-3.5" /> Updates we&apos;re shipping
            </div>
            <h2 className="font-display text-3xl font-extrabold md:text-4xl">
              Built for results — including <span className="text-[#ff8a00]">automations</span>
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {UPDATES.map((item, i) => (
              <Reveal key={item.title} delay={i * 80}>
                <div className="landing-tilt h-full rounded-2xl border border-white/10 p-6 transition hover:border-[#ff8a00]/50">
                  <div className="mb-4 h-1 w-10 rounded-full bg-[#ff8a00]" />
                  <h3 className="font-display text-xl font-bold">{item.title}</h3>
                  <p className="mt-3 text-sm text-white/70">{item.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="options" className="container py-16 md:py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-extrabold md:text-4xl">How do you want to start?</h2>
        </Reveal>
        <div className="mt-10 grid gap-6 md:grid-cols-2" style={{ perspective: "1200px" }}>
          <Reveal delay={60}>
            <div className="landing-tilt flex h-full flex-col rounded-2xl border bg-white p-8 shadow-sm">
              <Upload className="h-8 w-8 text-[#1e9fff]" />
              <h3 className="mt-4 font-display text-2xl font-bold">Upload my own flyer</h3>
              <p className="mt-2 flex-1 text-[#5a6a80]">Already designed? Upload it and we&apos;ll make it tappable.</p>
              <Button asChild className="mt-6 w-full bg-[#1e9fff] hover:bg-[#1788df]">
                <Link to={user ? "/submit-job?type=upload" : "/auth?next=/submit-job?type=upload"}>
                  Upload my flyer <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="landing-tilt flex h-full flex-col rounded-2xl border border-[#ff8a00]/35 bg-white p-8 shadow-sm">
              <Wand2 className="h-8 w-8 text-[#ff8a00]" />
              <h3 className="mt-4 font-display text-2xl font-bold">Design me a custom flyer</h3>
              <p className="mt-2 flex-1 text-[#5a6a80]">No design yet? Send a brief — we design and wire interactions.</p>
              <Button asChild className="mt-6 w-full bg-[#ff8a00] font-bold text-white hover:bg-[#e67a00]">
                <Link to={user ? "/submit-job?type=design" : "/auth?next=/submit-job?type=design"}>
                  Design my flyer <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="interactions" className="bg-[#e8f6ff] py-16 md:py-20">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-extrabold md:text-4xl">Choose your interactions</h2>
          </Reveal>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTERACTIONS.map((it, i) => (
              <Reveal key={it.id} delay={(i % 6) * 35} y={12}>
                <button
                  type="button"
                  onClick={() => setActive(it)}
                  className="group flex w-full items-start gap-3 rounded-xl border border-white bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e9fff]/12 text-[#1e9fff] transition group-hover:bg-[#1e9fff] group-hover:text-white">
                    <it.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{it.label}</div>
                    <div className="text-xs text-[#5a6a80] line-clamp-1">{it.short}</div>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="start" className="overflow-hidden">
        <div className="grid md:grid-cols-[1.1fr_1fr]">
          <div className="bg-[#0a1f44] px-6 py-12 text-white md:px-12 md:py-16">
            <img src={logo} alt="" className="h-10 w-auto brightness-0 invert" />
            <p className="mt-5 max-w-md font-display text-2xl font-bold md:text-3xl">
              AI-powered marketing solutions that help your business <span className="text-[#ff8a00]">grow.</span>
            </p>
          </div>
          <a
            href={startHref}
            className="landing-shimmer group relative flex items-center justify-between gap-4 overflow-hidden bg-[#ff8a00] px-6 py-12 font-display text-xl font-extrabold uppercase leading-tight text-white transition hover:bg-[#e67a00] md:px-10 md:text-2xl"
          >
            <span className="relative z-10">Let&apos;s make your marketing impossible to ignore.</span>
            <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#0a1f44] transition group-hover:scale-110">
              <ArrowRight className="h-6 w-6" />
            </span>
          </a>
        </div>
      </section>

      <footer className="border-t bg-white py-8 text-center text-sm text-[#5a6a80]">
        <div className="space-x-4">
          <Link to="/for-realtors" className="hover:text-[#0a1f44]">
            For Realtors
          </Link>
          <Link to="/affiliate" className="hover:text-[#0a1f44]">
            Affiliates
          </Link>
          <Link to="/examples" className="hover:text-[#0a1f44]">
            Examples
          </Link>
        </div>
        <div className="mt-2">© {new Date().getFullYear()} TapThatFlyer</div>
        <p className="mt-2 text-xs">
          TapThatFlyer is operated by BOWEN ENTERPRISES LLC ·{" "}
          <Link to="/privacy" className="underline">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link to="/terms" className="underline">
            Terms
          </Link>
        </p>
      </footer>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          {active && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <active.icon className="h-5 w-5" />
                  </div>
                  <DialogTitle className="text-xl">{active.label}</DialogTitle>
                </div>
                <DialogDescription className="pt-3 text-base text-foreground">{active.details}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button asChild>
                  <Link to={startHref}>Start a job with this interaction</Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

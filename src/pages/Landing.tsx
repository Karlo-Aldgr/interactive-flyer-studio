// Landing.tsx — visual upgrade only (copy/CTAs/links unchanged).
// Animated: fixed parallax background (gradient mesh + floating shapes/chips),
// hero fade-up + glow, manifesto staggered reveals, service cards 3D hover tilt,
// interactions grid staggered reveal, "01/02/03" numbers parallax faster than body,
// final CTA shimmer. All respects prefers-reduced-motion.
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Upload, Wand2, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";
import { INTERACTIONS, InteractionDef } from "@/lib/interactionsCatalog";
import { PhoneDemoMockup } from "@/components/landing/PhoneDemoMockup";
import ParallaxBackground from "@/components/landing/ParallaxBackground";
import Reveal from "@/components/landing/Reveal";
import Parallax from "@/components/landing/Parallax";

export default function Landing() {
  const { user } = useAuth();
  const [active, setActive] = useState<InteractionDef | null>(null);
  return (
    <div className="relative min-h-screen bg-background">
      <ParallaxBackground />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="TapThatFlyer logo" className="h-10 w-auto" />
          </Link>
          <nav className="hidden gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#options" className="hover:text-foreground transition">How it works</a>
            <a href="#interactions" className="hover:text-foreground transition">Interactions</a>
            <Link to="/examples" className="hover:text-foreground transition">Examples</Link>
            <a href="#start" className="hover:text-foreground transition">Get started</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="md:hidden"><Link to="/examples">Examples</Link></Button>
            {user ? (
              <>
                <Button asChild variant="ghost"><Link to="/my-jobs">My jobs</Link></Button>
                <Button asChild><Link to="/dashboard">Dashboard</Link></Button>
              </>
            ) : (
              <Button asChild className="shadow-glow"><Link to="/auth">Get started</Link></Button>
            )}
          </div>
        </div>
      </header>

      {/* Top — logo, manifesto & phone demo */}
      <section className="container overflow-visible pt-10 pb-8 md:pt-16 md:pb-12">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-5 text-center lg:text-left">
            <Reveal y={16}>
              <img
                src={logo}
                alt="TapThatFlyer logo"
                className="mx-auto h-auto w-full max-w-xl drop-shadow-[0_20px_40px_hsl(199_80%_30%/0.18)] lg:mx-0"
              />
            </Reveal>
            <Reveal>
              <h2 className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
                Are you creating flyers that do nothing but look good?
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p className="text-lg font-semibold text-foreground">
                Because looking good ain't enough anymore.
              </p>
            </Reveal>
            <Reveal delay={160}>
              <p className="text-lg text-muted-foreground">
                People don't just want information… they want <span className="text-gradient font-semibold">interaction</span>. They want <span className="text-gradient font-semibold">experience</span>.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <p className="text-base leading-relaxed text-muted-foreground">
                Tap That Flyer transforms ordinary flyers into interactive marketing experiences that capture attention, increase engagement, and drive real results. Instead of handing people a flyer they glance at and throw away, give them something they can tap, scan, watch, explore, and interact with instantly. From videos and special offers to bookings, websites, social media, and direct shopping, Tap That Flyer turns every flyer into a powerful digital experience designed to connect businesses, brands, creators, and events with their audience in a smarter, more memorable way.
              </p>
            </Reveal>
          </div>
          <Reveal delay={120} y={24}>
            <PhoneDemoMockup />
          </Reveal>
        </div>
      </section>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 gradient-canvas opacity-50" />
        <Parallax speed={-0.08} className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: "radial-gradient(circle, hsl(199 100% 60% / 0.25), transparent 65%)" }} />
        </Parallax>
        <div className="container relative py-16 md:py-24 text-center">
          <Reveal>
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              A done-for-you interactive flyer service
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-6xl">
              We turn your flyers into <span className="text-gradient">tappable experiences</span>.
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Send us your flyer or let our team design one from scratch. We make every element interactive — links, forms, videos, bookings, RSVPs and more — then deliver it as a shareable link and QR code.
            </p>
          </Reveal>
          <Reveal delay={280}>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="shadow-glow">
                <Link to={user ? "/submit-job" : "/auth?next=/submit-job"}>
                  Start a job <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#interactions">Browse interactions</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={`sms:+16625491457?&body=${encodeURIComponent("Hi, I'm interested in getting an interactive flyer created for me")}`}>
                  Text help
                </a>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Two service options */}
      <section id="options" className="container py-20">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Pick the way you want to work with us</h2>
          <p className="mt-4 text-muted-foreground">Sign up, submit your job and we'll review, price and send a payment link.</p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-2" style={{ perspective: "1200px" }}>
          <Reveal delay={60}>
            <div className="landing-tilt group relative h-full overflow-hidden rounded-3xl border border-border bg-card/90 p-8 shadow-sm backdrop-blur hover:shadow-elegant">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Upload className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-2xl font-bold">I want to upload my own flyer</h3>
              <p className="mt-3 text-muted-foreground">
                Already have a flyer designed? Upload it and tell us which interactions you want. Our team will review, send you a price and payment link, then build it.
              </p>
              <Button asChild size="lg" className="mt-7 w-full">
                <Link to={user ? "/submit-job?type=upload" : "/auth?next=/submit-job?type=upload"}>
                  Upload my flyer <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="landing-tilt group relative h-full overflow-hidden rounded-3xl border border-border bg-card/90 p-8 shadow-sm backdrop-blur hover:shadow-elegant">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Wand2 className="h-6 w-6" />
              </div>
              <h3 className="mt-5 font-display text-2xl font-bold">Design me a custom flyer</h3>
              <p className="mt-3 text-muted-foreground">
                No design yet? Send us a brief and pick your interactions. Our team designs the flyer and builds in every interaction. We'll send a price and payment link before starting.
              </p>
              <Button asChild size="lg" className="mt-7 w-full shadow-glow">
                <Link to={user ? "/submit-job?type=design" : "/auth?next=/submit-job?type=design"}>
                  Design my flyer <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Interactions list - clickable */}
      <section id="interactions" className="relative bg-secondary/40 backdrop-blur-sm">
        <div className="container py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Choose your interactions</h2>
            <p className="mt-4 text-muted-foreground">
              Tap any interaction to see what it does. Pick the ones you want when you submit your job.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTERACTIONS.map((it, i) => (
              <Reveal key={it.id} delay={(i % 6) * 50} y={16}>
                <button
                  type="button"
                  onClick={() => setActive(it)}
                  className="group flex w-full items-start gap-3 rounded-xl border border-border bg-card/90 px-4 py-3 text-left backdrop-blur transition hover:-translate-y-0.5 hover:shadow-elegant hover:border-primary/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition group-hover:scale-110">
                    <it.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{it.label}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{it.short}</div>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container py-20">
        <div className="grid gap-12 md:grid-cols-3">
          {[
            { n: "01", t: "Sign up & submit", b: "Create an account, upload your flyer (or send a brief) and pick your interactions." },
            { n: "02", t: "We review & quote", b: "Our team reviews your job, sends you a price and a payment link." },
            { n: "03", t: "We build & deliver", b: "Once paid, we wire up every interaction and deliver a shareable link + QR code." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <Parallax speed={-0.12}>
                <div className="text-gradient font-display text-5xl font-extrabold">{s.n}</div>
              </Parallax>
              <h3 className="mt-2 font-display text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-muted-foreground">{s.b}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="start" className="container py-24">
        <Reveal>
          <div className="landing-shimmer relative overflow-hidden rounded-3xl gradient-hero p-12 text-center shadow-elegant">
            <h2 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">Ready to make your flyer interactive?</h2>
            <p className="mx-auto mt-3 max-w-xl text-primary-foreground/90">
              Sign up and submit your job — we'll take it from there.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link to={user ? "/submit-job?type=upload" : "/auth?next=/submit-job?type=upload"}>
                  <Upload className="mr-1 h-4 w-4" /> Upload my own flyer
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link to={user ? "/submit-job?type=design" : "/auth?next=/submit-job?type=design"}>
                  <Wand2 className="mr-1 h-4 w-4" /> Design me a custom flyer
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <div className="space-x-4">
          <Link to="/for-realtors" className="hover:text-foreground underline">For Realtors</Link>
          <Link to="/examples" className="hover:text-foreground underline">Examples</Link>
        </div>
        <div className="mt-2">© {new Date().getFullYear()} TapThatFlyer</div>
        <p className="mt-2 text-xs">
          TapThatFlyer is operated by BOWEN ENTERPRISES LLC ·{" "}
          <Link to="/privacy" className="underline hover:text-foreground">Privacy</Link>
          {" · "}
          <Link to="/terms" className="underline hover:text-foreground">Terms</Link>
        </p>
      </footer>

      {/* Interaction details dialog */}
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
                <DialogDescription className="pt-3 text-base text-foreground">
                  {active.details}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button asChild>
                  <Link to={user ? "/submit-job" : "/auth?next=/submit-job"}>
                    Start a job with this interaction
                  </Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

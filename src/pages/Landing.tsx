import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, MousePointerClick, BarChart3, QrCode, Layers, Smartphone, ArrowRight, Wand2 } from "lucide-react";

const features = [
  { icon: Layers, title: "Drag-and-drop canvas", body: "Text, images, icons, shapes, buttons. Multi-page flyers with snap-to-grid alignment." },
  { icon: MousePointerClick, title: "Make any element tappable", body: "Open URLs, popups, videos, lead forms, calls, SMS, page nav, reveal — assigned to any layer." },
  { icon: Smartphone, title: "Mobile-first viewer", body: "Published flyers feel like a native app. Smooth animations, instant taps." },
  { icon: QrCode, title: "Share by link or QR", body: "One click to publish. Auto-generated QR for posters, business cards, and signage." },
  { icon: BarChart3, title: "Engagement analytics", body: "See views, clicks per element, form submissions and your most interacted areas." },
  { icon: Wand2, title: "Built for speed", body: "Undo/redo, autosave, multi-page support — production-grade design tooling." },
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-hero shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold">TapThatFlyer</span>
          </Link>
          <nav className="hidden gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#how" className="hover:text-foreground transition">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild><Link to="/dashboard">Open dashboard</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
                <Button asChild className="shadow-glow"><Link to="/auth?mode=signup">Get started</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 gradient-canvas opacity-60" />
        <div className="container relative grid gap-12 py-20 md:grid-cols-2 md:py-28">
          <div className="flex flex-col justify-center animate-fade-in">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Interactive flyers, made simple
            </div>
            <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-6xl">
              Design flyers your audience{" "}
              <span className="text-gradient">actually taps</span>.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted-foreground">
              TapThatFlyer turns static designs into interactive experiences. Add a button, attach an action — open URLs, capture leads, play videos, call you. Publish in one click with a link and QR.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="shadow-glow">
                <Link to={user ? "/dashboard" : "/auth?mode=signup"}>
                  Start designing free <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#features">See features</a>
              </Button>
            </div>
          </div>

          {/* Mock canvas preview */}
          <div className="relative animate-scale-in">
            <div className="absolute -inset-8 -z-10 gradient-hero opacity-20 blur-3xl" />
            <div className="relative rounded-3xl border border-border bg-card p-4 shadow-elegant">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
                <span className="ml-2 text-xs text-muted-foreground">Summer Festival Flyer</span>
              </div>
              <div className="relative mt-4 aspect-[3/4] overflow-hidden rounded-2xl gradient-hero p-8">
                <div className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/80">June 14 · Riverside Park</div>
                <div className="mt-2 font-display text-4xl font-extrabold leading-tight text-primary-foreground">Summer Music Festival</div>
                <div className="mt-3 text-sm text-primary-foreground/90">3 stages · 20+ artists · food trucks</div>

                <div className="absolute inset-x-8 bottom-8 flex flex-col gap-3">
                  <div className="flex items-center justify-between rounded-xl bg-card/95 px-4 py-3 text-sm shadow-md">
                    <span className="font-semibold">🎟️ Get tickets</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Open URL</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-card/95 px-4 py-3 text-sm shadow-md">
                    <span className="font-semibold">📍 Get directions</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Popup</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-card/95 px-4 py-3 text-sm shadow-md">
                    <span className="font-semibold">💌 Join the list</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Lead form</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Everything you need to make flyers click</h2>
          <p className="mt-4 text-muted-foreground">A design tool and an interaction builder, in one place.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-border bg-card p-6 transition hover:shadow-elegant">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How */}
      <section id="how" className="bg-secondary/50">
        <div className="container grid gap-12 py-20 md:grid-cols-3">
          {[
            { n: "01", t: "Design", b: "Drag elements onto the canvas. Style, arrange, add multiple pages." },
            { n: "02", t: "Make it interactive", b: "Click any element to attach an action — link, popup, form, call, video." },
            { n: "03", t: "Publish & track", b: "Share the link or QR. Watch views, clicks, and form leads come in." },
          ].map((s) => (
            <div key={s.n}>
              <div className="text-gradient font-display text-5xl font-extrabold">{s.n}</div>
              <h3 className="mt-2 font-display text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-muted-foreground">{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container py-24">
        <div className="relative overflow-hidden rounded-3xl gradient-hero p-12 text-center shadow-elegant">
          <h2 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">Make your next flyer interactive</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/90">Free to start. No credit card. Publish in minutes.</p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to={user ? "/dashboard" : "/auth?mode=signup"}>
              Create your first flyer <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TapThatFlyer
      </footer>
    </div>
  );
}

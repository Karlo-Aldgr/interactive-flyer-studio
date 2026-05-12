import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  Upload, Wand2, ArrowRight, Link as LinkIcon, MessageSquare, Video, Music, Phone, MessageCircle,
  FormInput, Navigation, Eye, CalendarPlus, Ticket, CheckSquare, ShoppingCart, BadgePercent,
  MapPin, Package, MessagesSquare, BarChart3, Mail, CalendarCheck, Images,
} from "lucide-react";
import logo from "@/assets/logo.png";

const interactions = [
  { icon: LinkIcon, label: "Open URL" },
  { icon: MessageSquare, label: "Show popup" },
  { icon: Video, label: "Play video" },
  { icon: Music, label: "Play audio" },
  { icon: Phone, label: "Call phone" },
  { icon: MessageCircle, label: "Send SMS" },
  { icon: FormInput, label: "Capture form" },
  { icon: Navigation, label: "Go to page" },
  { icon: Eye, label: "Reveal layer" },
  { icon: CalendarPlus, label: "Add to calendar" },
  { icon: Ticket, label: "Buy ticket" },
  { icon: CheckSquare, label: "RSVP" },
  { icon: ShoppingCart, label: "Link to checkout" },
  { icon: BadgePercent, label: "Coupon" },
  { icon: MapPin, label: "Open in maps (GPS)" },
  { icon: Package, label: "Buy product" },
  { icon: MessagesSquare, label: "Air messages (chat bubbles)" },
  { icon: BarChart3, label: "Poll" },
  { icon: Mail, label: "Subscribe (email signup)" },
  { icon: CalendarCheck, label: "Book appointment" },
  { icon: Images, label: "Photo gallery" },
];

const UPLOAD_MAILTO =
  "mailto:hello@tapthatflyer.com?subject=I%20want%20to%20upload%20my%20own%20flyer&body=Hi%2C%20I%27d%20like%20you%20to%20make%20my%20existing%20flyer%20interactive.%20I%27ll%20attach%20my%20flyer%20here%3A%0A%0AInteractions%20I%20want%3A%0A-%20";
const DESIGN_MAILTO =
  "mailto:hello@tapthatflyer.com?subject=Design%20me%20a%20custom%20interactive%20flyer&body=Hi%2C%20I%27d%20like%20you%20to%20design%20a%20custom%20interactive%20flyer%20for%20me.%0A%0ABusiness%2FEvent%3A%0AGoal%3A%0AInteractions%20I%20want%3A%0A-%20";

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="TapThatFlyer logo" className="h-10 w-auto" />
          </Link>
          <nav className="hidden gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#options" className="hover:text-foreground transition">How it works</a>
            <a href="#interactions" className="hover:text-foreground transition">Interactions</a>
            <a href="#start" className="hover:text-foreground transition">Get started</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Button asChild><Link to="/dashboard">Open dashboard</Link></Button>
            ) : (
              <Button asChild className="shadow-glow">
                <a href="#start">Get started</a>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Big logo banner */}
      <div className="container flex justify-center pt-10 pb-4 md:pt-16">
        <img src={logo} alt="TapThatFlyer logo" className="w-full max-w-3xl h-auto" />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 gradient-canvas opacity-60" />
        <div className="container relative py-16 md:py-24 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            A done-for-you interactive flyer service
          </div>
          <h1 className="font-display text-5xl font-extrabold tracking-tight md:text-6xl">
            We turn your flyers into <span className="text-gradient">tappable experiences</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Send us your flyer or let our team design one from scratch. We make every element interactive — links, forms, videos, bookings, RSVPs and more — then deliver it as a shareable link and QR code.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="shadow-glow">
              <a href="#options">
                See your two options <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#interactions">Browse interactions</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Two service options */}
      <section id="options" className="container py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Pick the way you want to work with us</h2>
          <p className="mt-4 text-muted-foreground">Two simple paths. Either way, we handle the interactive build for you.</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Option 1 */}
          <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-sm transition hover:shadow-elegant">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Upload className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-display text-2xl font-bold">I want to upload my own flyer</h3>
            <p className="mt-3 text-muted-foreground">
              Already have a flyer designed? Send it to us and tell us which interactions you want. We'll layer them on top of your design and deliver a polished, shareable experience.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li>• Upload PDF, PNG or JPG</li>
              <li>• Pick the interactions from the list below</li>
              <li>• We make it tappable and send back a link + QR</li>
            </ul>
            <Button asChild size="lg" className="mt-7 w-full">
              <a href={UPLOAD_MAILTO}>
                Upload my flyer <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </div>

          {/* Option 2 */}
          <div className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 shadow-sm transition hover:shadow-elegant">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Wand2 className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-display text-2xl font-bold">Design me a custom flyer</h3>
            <p className="mt-3 text-muted-foreground">
              No design yet? Our team will create a custom flyer that fits your brand and goals — then build in every interaction your audience needs.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              <li>• Custom design tailored to your business or event</li>
              <li>• Pick the interactions from the list below</li>
              <li>• Final delivery as a link + QR code, ready to share</li>
            </ul>
            <Button asChild size="lg" className="mt-7 w-full shadow-glow">
              <a href={DESIGN_MAILTO}>
                Design my flyer <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Interactions list */}
      <section id="interactions" className="bg-secondary/50">
        <div className="container py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold md:text-4xl">Choose your interactions</h2>
            <p className="mt-4 text-muted-foreground">
              Every flyer can include any combination of these. Tell us which ones you want and we'll wire them in.
            </p>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {interactions.map((it) => (
              <div
                key={it.label}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition hover:shadow-elegant"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <it.icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{it.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container py-20">
        <div className="grid gap-12 md:grid-cols-3">
          {[
            { n: "01", t: "Tell us your goal", b: "Send your flyer or your brief. Pick the interactions you want from the list above." },
            { n: "02", t: "We build it", b: "Our team designs (if needed) and wires up every tap, form, video and booking." },
            { n: "03", t: "Share & track", b: "You get a link and QR code to share anywhere — plus engagement analytics." },
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
      <section id="start" className="container py-24">
        <div className="relative overflow-hidden rounded-3xl gradient-hero p-12 text-center shadow-elegant">
          <h2 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">Ready to make your flyer interactive?</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/90">
            Pick the option that fits you — we'll take it from there.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary">
              <a href={UPLOAD_MAILTO}>
                <Upload className="mr-1 h-4 w-4" /> Upload my own flyer
              </a>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href={DESIGN_MAILTO}>
                <Wand2 className="mr-1 h-4 w-4" /> Design me a custom flyer
              </a>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TapThatFlyer
      </footer>
    </div>
  );
}

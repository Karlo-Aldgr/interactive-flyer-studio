import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home, Images, BarChart3, Share2, ArrowRight, CheckCircle2 } from "lucide-react";

const features = [
  { icon: Home, title: "Listing management", desc: "Centralized dashboard for every property — Active, Pending, Sold, and Draft." },
  { icon: Images, title: "Drag-and-drop photo galleries", desc: "Organize exterior, interior, and detail shots. Buyers see a slideshow; agents can download originals." },
  { icon: BarChart3, title: "Lead & view analytics", desc: "Per-listing view counts, form submissions, appointments, and subscriber leads." },
  { icon: Share2, title: "Shareable flyer per listing", desc: "Every listing gets a flyer you can share by link, QR code, or social post." },
];

const bullets = [
  "Unlimited listings",
  "Photo gallery per property with categories",
  "Lead capture forms & appointment bookings",
  "Custom domain & QR codes",
  "Real-time view tracking",
];

export default function ForRealtors() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg">TapThatFlyer</Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
            <Button asChild size="sm"><Link to="/realtor/apply">Apply now</Link></Button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-16 sm:py-24 text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          <Home className="h-3 w-3" /> For Real Estate Agents
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          A portal built for realtors
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Manage every listing, photo gallery, and lead in one place. Share interactive flyers that capture serious buyers.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <Button asChild size="lg" className="shadow-glow">
            <Link to="/realtor/apply">Apply for Realtor access <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/examples">See example flyers</Link>
          </Button>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <Card key={f.title} className="p-6">
              <f.icon className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 py-16">
        <Card className="p-8 space-y-6">
          <h2 className="text-2xl font-bold text-center">What you get</h2>
          <ul className="space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          <Button asChild size="lg" className="w-full">
            <Link to="/realtor/apply">Apply for Realtor access</Link>
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already approved? <Link to="/auth?next=/realtor" className="underline">Sign in to the Realtor Portal</Link>
          </p>
        </Card>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} TapThatFlyer
      </footer>
    </div>
  );
}

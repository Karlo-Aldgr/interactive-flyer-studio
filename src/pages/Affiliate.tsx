import { useEffect } from "react";
import { Link } from "react-router-dom";
import { BadgeDollarSign, Link2, LineChart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAffiliate } from "@/hooks/useAffiliate";

const PERKS = [
  {
    icon: BadgeDollarSign,
    title: "Recurring commissions",
    body: "Earn a share of every project your referrals pay for — flyers, portals and add-ons.",
  },
  {
    icon: Link2,
    title: "Your own referral link",
    body: "Share one link. We track every signup that comes through it automatically.",
  },
  {
    icon: LineChart,
    title: "Live dashboard",
    body: "See referrals, pending payouts and paid commissions in one place.",
  },
  {
    icon: Users,
    title: "Made for creators",
    body: "Perfect for designers, marketers, realtors and anyone with a local business network.",
  },
];

export default function Affiliate() {
  const { isAffiliate, application } = useAffiliate();

  useEffect(() => {
    document.title = "Affiliate Program | TapThatFlyer";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute("content", "Earn commissions referring businesses to TapThatFlyer interactive flyers. Join the affiliate program.");
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Affiliate program</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Get paid to share TapThatFlyer</h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Refer businesses, realtors and event organizers to interactive flyers that actually convert — and earn a
          commission on every project they order.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {isAffiliate ? (
            <Button asChild size="lg">
              <Link to="/affiliate/dashboard">Open affiliate dashboard</Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link to="/affiliate/apply">
                {application?.status === "pending" ? "Application pending" : "Become an affiliate"}
              </Link>
            </Button>
          )}
          <Button asChild size="lg" variant="outline">
            <Link to="/examples">See examples</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {PERKS.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="p-6">
              <Icon className="h-6 w-6 text-primary" />
              <h2 className="mt-3 text-lg font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-8 p-6 sm:p-8">
          <h2 className="text-lg font-semibold">How it works</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li><strong className="text-foreground">1. Apply.</strong> Tell us about you and your audience.</li>
            <li><strong className="text-foreground">2. Get approved.</strong> We review and hand you a referral code and link.</li>
            <li><strong className="text-foreground">3. Share.</strong> Post your link anywhere — socials, email, in person.</li>
            <li><strong className="text-foreground">4. Get paid.</strong> Track referrals and payouts in your dashboard.</li>
          </ol>
        </Card>

        <div className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link to="/">Back to home</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

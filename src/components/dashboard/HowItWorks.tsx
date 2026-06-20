import { ClipboardList, MessageSquareQuote, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

const STEPS = [
  {
    icon: ClipboardList,
    title: "Submit your project",
    description: "Upload an existing flyer or ask us to design one. Pick the interactions you want.",
  },
  {
    icon: MessageSquareQuote,
    title: "We review & quote",
    description: "Our team reviews your brief, sends a price, and keeps you updated on progress.",
  },
  {
    icon: Sparkles,
    title: "Get your TapFlyer",
    description: "Once approved, your interactive flyer goes live with a shareable link and QR code.",
  },
] as const;

export function HowItWorks() {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold">How it works</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, description }, i) => (
          <Card key={title} className="p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-1 text-xs font-medium text-muted-foreground">Step {i + 1}</div>
            <h3 className="mt-1 font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [validationMessage, setValidationMessage] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;

    setValidationMessage("");
    setStatus("idle");

    const trimmed = email.trim();
    if (!trimmed) {
      setValidationMessage("Please enter your email address.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setValidationMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch(NEWSLETTER_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmed,
          source: "TapThatFlyer Website",
          subscribed_at: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <section id="newsletter" className="bg-[#0a1f44] py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center text-white">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#ff8a00]/15 text-[#ff8a00]">
            <Mail className="h-6 w-6" />
          </div>
          <h2 className="font-display text-4xl font-extrabold md:text-5xl">Stay in the loop</h2>
          <p className="mt-4 text-lg text-white/80 md:text-xl">
            Get the latest TapThatFlyer updates, marketing tips, and new features delivered straight to your inbox.
          </p>

          <form onSubmit={handleSubmit} className="mt-10" noValidate>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-center">
              <div className="w-full sm:max-w-md">
                <Input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationMessage) setValidationMessage("");
                    if (status === "error" || status === "success") setStatus("idle");
                  }}
                  placeholder="Enter your email address"
                  required
                  disabled={status === "loading"}
                  aria-invalid={!!validationMessage || status === "error"}
                  aria-describedby="newsletter-feedback"
                  className={cn(
                    "h-12 rounded-lg border-0 bg-white px-4 text-[#0a1f44] placeholder:text-[#5a6a80] focus-visible:ring-2 focus-visible:ring-[#ff8a00] focus-visible:ring-offset-0",
                    (validationMessage || status === "error") && "ring-2 ring-red-500 focus-visible:ring-red-500",
                  )}
                />
              </div>
              <Button
                type="submit"
                disabled={status === "loading"}
                className="h-12 w-full rounded-lg bg-[#ff8a00] px-10 font-bold text-white hover:bg-[#e67a00] disabled:opacity-70 sm:w-auto"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Subscribing...
                  </>
                ) : (
                  "Subscribe"
                )}
              </Button>
            </div>

            <div id="newsletter-feedback" className="mt-3 min-h-[1.25rem] text-sm" aria-live="polite">
              {validationMessage ? (
                <span className="text-red-400">{validationMessage}</span>
              ) : status === "success" ? (
                <span className="text-emerald-400">You&apos;re subscribed! Thanks for joining us.</span>
              ) : status === "error" ? (
                <span className="text-red-400">Something went wrong. Please try again.</span>
              ) : (
                <span className="text-white/60" />
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

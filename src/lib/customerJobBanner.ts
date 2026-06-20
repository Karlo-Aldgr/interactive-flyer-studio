import type { UserJob } from "@/lib/userJobs";

export type CustomerBanner = {
  title: string;
  description: string;
};

const ACTIVE_EXCLUDE = new Set(["delivered", "cancelled"]);

export function getCustomerStatusBanner(jobs: UserJob[]): CustomerBanner | null {
  if (jobs.length === 0) return null;

  const active = jobs.filter((j) => !ACTIVE_EXCLUDE.has(j.status));
  if (active.length === 0) {
    return {
      title: "All projects complete",
      description: "Your delivered projects are finished. Submit a new request anytime you need another TapFlyer.",
    };
  }

  const previewReady = active.find((j) => j.preview_ready && j.flyer?.public_slug);
  if (previewReady) {
    return {
      title: "A preview is ready for you",
      description: "Open your project below to review the interactive flyer before we finalize delivery.",
    };
  }

  const awaitingPayment = active.find((j) => j.status === "quoted" && j.payment_link);
  if (awaitingPayment) {
    return {
      title: "Your quote is ready",
      description: "Review the price on your project and use the Pay now button when you're ready to proceed.",
    };
  }

  const quoted = active.find((j) => j.status === "quoted");
  if (quoted) {
    return {
      title: "Quote sent",
      description: "We've sent pricing details. Check your project or email for next steps.",
    };
  }

  const inProduction = active.find((j) => ["paid", "in_progress", "preview_ready"].includes(j.status));
  if (inProduction) {
    return {
      title: "We're working on your project",
      description: "Your order is in production. We'll notify you when a preview or final link is ready.",
    };
  }

  return {
    title: "Your project is under review",
    description: "We'll contact you by email or phone with a quote. Once approved, your design studio unlocks here automatically.",
  };
}

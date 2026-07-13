/**
 * Rules-based flyer performance insights (Phase 3).
 * Pure compute — no network. Fed from portal analytics_events + leads.
 */

export type InsightSeverity = "critical" | "warning" | "info";

export type FlyerInsight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  metric?: string;
};

export type FlyerInsightsInput = {
  views: number;
  clicks: number;
  uniqueVisitors: number;
  leadCount: number;
  /** True when the flyer has forms, subscribe, booking, or poll actions. */
  hasLeadCapture: boolean;
  /** Hotspot / interactive layers that can receive clicks. */
  interactiveLayers: Array<{ id: string; label: string; clicks: number }>;
  /** Traffic sources sorted by count desc: [label, count][] */
  trafficSources: Array<[string, number]>;
};

const MIN_VIEWS_FOR_RULES = 10;
const LOW_CTR = 0.03;
const LOW_LEAD_RATE = 0.02;
const DOMINANT_SOURCE_SHARE = 0.85;

export function buildFlyerInsights(input: FlyerInsightsInput): FlyerInsight[] {
  const {
    views,
    clicks,
    uniqueVisitors,
    leadCount,
    hasLeadCapture,
    interactiveLayers,
    trafficSources,
  } = input;

  if (views < MIN_VIEWS_FOR_RULES) {
    return [
      {
        id: "not-enough-data",
        severity: "info",
        title: "Not enough data yet",
        detail: `Suggestions unlock after about ${MIN_VIEWS_FOR_RULES} views. Share the flyer and check back.`,
        metric: `${views} view${views === 1 ? "" : "s"} so far`,
      },
    ];
  }

  const insights: FlyerInsight[] = [];
  const ctr = views > 0 ? clicks / views : 0;
  const leadRate = views > 0 ? leadCount / views : 0;
  const trafficTotal = trafficSources.reduce((s, [, n]) => s + n, 0);

  if (ctr < LOW_CTR) {
    insights.push({
      id: "low-ctr",
      severity: ctr < 0.01 ? "critical" : "warning",
      title: "Low click-through rate",
      detail:
        "Few people are tapping interactive spots. Make hotspots larger, clearer, or move the main CTA higher on the first page.",
      metric: `${(ctr * 100).toFixed(1)}% CTR (${clicks} clicks / ${views} views)`,
    });
  }

  const deadHotspots = interactiveLayers
    .filter((l) => l.clicks === 0)
    .slice(0, 5);
  if (deadHotspots.length > 0 && interactiveLayers.length > 0) {
    const names = deadHotspots.map((l) => l.label).join(", ");
    insights.push({
      id: "dead-hotspots",
      severity: deadHotspots.length >= 3 ? "warning" : "info",
      title:
        deadHotspots.length === 1
          ? "One hotspot has never been tapped"
          : `${deadHotspots.length} hotspots have never been tapped`,
      detail: `Consider removing, resizing, or rewriting these: ${names}.`,
      metric: `${deadHotspots.length} of ${interactiveLayers.length} interactive layers`,
    });
  }

  if (hasLeadCapture && leadRate < LOW_LEAD_RATE) {
    insights.push({
      id: "low-leads",
      severity: leadRate === 0 ? "critical" : "warning",
      title: "Low lead conversion",
      detail:
        "You have lead-capture actions, but few submissions relative to views. Shorten forms, strengthen the offer, or put the form CTA earlier in the flyer.",
      metric: `${leadCount} lead${leadCount === 1 ? "" : "s"} / ${views} views (${(leadRate * 100).toFixed(1)}%)`,
    });
  }

  if (trafficTotal >= MIN_VIEWS_FOR_RULES && trafficSources.length > 0) {
    const [topLabel, topCount] = trafficSources[0];
    const share = topCount / trafficTotal;
    const isDirectHeavy =
      share >= DOMINANT_SOURCE_SHARE &&
      /direct|unknown|other/i.test(topLabel);
    if (isDirectHeavy) {
      insights.push({
        id: "direct-heavy",
        severity: "info",
        title: "Most traffic looks unattributed",
        detail:
          "Add ?utm_source=facebook (or instagram, tiktok) to shared links so you can see which channel drives views.",
        metric: `${Math.round(share * 100)}% ${topLabel}`,
      });
    } else if (share >= DOMINANT_SOURCE_SHARE && trafficSources.length === 1) {
      insights.push({
        id: "single-source",
        severity: "info",
        title: "Traffic comes from one source",
        detail: `Almost all views are from ${topLabel}. Test another channel or post to broaden reach.`,
        metric: `${Math.round(share * 100)}% ${topLabel}`,
      });
    }
  }

  if (uniqueVisitors >= MIN_VIEWS_FOR_RULES && clicks === 0) {
    insights.push({
      id: "no-clicks",
      severity: "critical",
      title: "Views but zero clicks",
      detail:
        "People open the flyer but nothing is tapped. Confirm hotspots are on the published pages and that actions are assigned.",
      metric: `${uniqueVisitors} unique visitors`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: "healthy",
      severity: "info",
      title: "Engagement looks healthy",
      detail:
        "CTR and lead signals are within normal ranges for this sample. Keep testing CTAs and share links with UTM tags.",
      metric: `${(ctr * 100).toFixed(1)}% CTR · ${uniqueVisitors} unique`,
    });
  }

  return insights.slice(0, 6);
}

import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ZernioAccountsPanel } from "@/components/social/ZernioAccountsPanel";
import { ZernioComposer, ZernioPostList } from "@/components/social/ZernioComposer";

const TABS = ["accounts", "compose", "scheduled", "history"] as const;

/**
 * Client-facing Zernio social publishing. All account selection and posting
 * is scoped server-side to the client's own Zernio profile via the
 * zernio-* edge functions — the API key never reaches the browser.
 */
export default function ClientSocial() {
  const { tab } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state as { jobId?: string; extraJobCount?: number } | null;
  const jobId = state?.jobId ?? searchParams.get("project") ?? searchParams.get("job");
  const extraJobCount = state?.extraJobCount
    ?? Math.max(0, Number(searchParams.get("more") ?? 0) || 0);
  const tabParam = searchParams.get("tab");
  const requested = tab ?? (tabParam === "create-post" ? "compose" : tabParam) ?? "";
  const initial = TABS.includes(requested as (typeof TABS)[number])
    ? (requested as (typeof TABS)[number])
    : jobId
    ? "compose"
    : "accounts";

  return (
    <DashboardShell>
      <PageHeader
        title="Social Media"
        description="Connect your social accounts, create posts and schedule publishing."
      />
      <Tabs defaultValue={initial} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="accounts">Connected Accounts</TabsTrigger>
          <TabsTrigger value="compose">Create Post</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled Posts</TabsTrigger>
          <TabsTrigger value="history">Post History</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="pt-2">
          <ZernioAccountsPanel redirectPath="/social-media" />
        </TabsContent>
        <TabsContent value="compose" className="pt-2">
          <ZernioComposer initialJobId={jobId} extraJobCount={extraJobCount} />
        </TabsContent>
        <TabsContent value="scheduled" className="pt-2">
          <ZernioPostList
            statuses={["scheduled", "publishing", "draft"]}
            emptyMessage="No scheduled posts. Create one from the Create Post tab."
          />
        </TabsContent>
        <TabsContent value="history" className="pt-2">
          <ZernioPostList
            statuses={["published", "failed", "cancelled"]}
            emptyMessage="No posts published yet."
          />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

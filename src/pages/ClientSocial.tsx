import { useParams } from "react-router-dom";
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
  const initial = TABS.includes((tab ?? "") as (typeof TABS)[number])
    ? (tab as (typeof TABS)[number])
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
          <ZernioComposer />
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

import { useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubscribersPanel } from "@/components/marketing/SubscribersPanel";
import { CampaignsPanel } from "@/components/marketing/CampaignsPanel";
import { AudiencesPanel } from "@/components/marketing/AudiencesPanel";
import { MarketingAnalyticsPanel } from "@/components/marketing/MarketingAnalyticsPanel";
import { WelcomeEmailSettings } from "@/components/marketing/WelcomeEmailSettings";

const TABS = ["subscribers", "campaigns", "audiences", "analytics", "settings"] as const;

export default function ClientMarketing() {
  const { tab } = useParams();
  const { user } = useAuth();
  const clientId = user?.id ?? null;
  const initial = TABS.includes((tab ?? "") as (typeof TABS)[number])
    ? (tab as (typeof TABS)[number])
    : "subscribers";

  return (
    <DashboardShell>
      <PageHeader
        title="Marketing"
        description="Your subscribers, email campaigns and signup analytics."
      />
      <Tabs defaultValue={initial} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="audiences">Audiences</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="subscribers">
          <SubscribersPanel clientId={clientId} />
        </TabsContent>
        <TabsContent value="campaigns">
          <CampaignsPanel clientId={clientId} />
        </TabsContent>
        <TabsContent value="audiences">
          <AudiencesPanel clientId={clientId} />
        </TabsContent>
        <TabsContent value="analytics">
          <MarketingAnalyticsPanel clientId={clientId} />
        </TabsContent>
        <TabsContent value="settings">
          <WelcomeEmailSettings clientId={clientId} />
        </TabsContent>
      </Tabs>
    </DashboardShell>
  );
}

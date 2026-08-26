import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SubscribersPanel } from "@/components/marketing/SubscribersPanel";
import { CampaignsPanel } from "@/components/marketing/CampaignsPanel";
import { AudiencesPanel } from "@/components/marketing/AudiencesPanel";
import { MarketingAnalyticsPanel } from "@/components/marketing/MarketingAnalyticsPanel";
import { WelcomeEmailSettings } from "@/components/marketing/WelcomeEmailSettings";
import { MarketingClient, fetchMarketingClients } from "@/lib/marketing";

const TABS = ["subscribers", "campaigns", "audiences", "analytics", "settings"] as const;

export default function AdminMarketing() {
  const { tab } = useParams();
  const initial = TABS.includes((tab ?? "") as (typeof TABS)[number])
    ? (tab as (typeof TABS)[number])
    : "subscribers";
  const [clients, setClients] = useState<MarketingClient[]>([]);
  const [clientFilter, setClientFilter] = useState("all");

  useEffect(() => {
    fetchMarketingClients()
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  return (
    <AdminLayout active="marketing">
      <Tabs defaultValue={initial} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="audiences">Audiences</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="subscribers">
          <SubscribersPanel
            clientId={undefined}
            isAdmin
            clients={clients}
            clientFilter={clientFilter}
            onClientFilterChange={setClientFilter}
          />
        </TabsContent>
        <TabsContent value="campaigns">
          <CampaignsPanel clientId={null} isAdmin clients={clients} businessName="TapThatFlyer" />
        </TabsContent>
        <TabsContent value="audiences">
          <AudiencesPanel clientId={null} isAdmin clients={clients} />
        </TabsContent>
        <TabsContent value="analytics">
          <MarketingAnalyticsPanel clientId={undefined} />
        </TabsContent>
        <TabsContent value="settings">
          <WelcomeEmailSettings clientId={null} />
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}

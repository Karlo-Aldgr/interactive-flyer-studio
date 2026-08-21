import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSocialAccounts } from "@/hooks/useSocialAccounts";
import { ConnectPlatformGrid } from "@/components/social/ConnectPlatformGrid";
import { ComposerPanel } from "@/components/social/ComposerPanel";
import { PublishedPanel, ScheduledPanel } from "@/components/social/PostListPanels";
import { AnalyticsPanel } from "@/components/social/AnalyticsPanel";
import { IntegrationsPanel } from "@/components/social/IntegrationsPanel";
import { SocialHistoryPanel } from "@/components/social/SocialHistoryPanel";


export default function SocialManager() {
  const social = useSocialAccounts("/dashboard/social");

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">Social Media Manager</h1>
        <p className="text-sm text-muted-foreground">
          Connect your accounts with official platform authorization, then compose, schedule and
          track posts. TapThatFlyer never asks for social media passwords.
        </p>
      </header>

      <Tabs defaultValue="accounts">
        <TabsList className="flex-wrap">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="compose">Create Social Post</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="settings">Settings / Integrations</TabsTrigger>

        </TabsList>

        <TabsContent value="accounts" className="pt-4">
          <ConnectPlatformGrid social={social} />
        </TabsContent>
        <TabsContent value="compose" className="pt-4">
          <ComposerPanel social={social} />
        </TabsContent>
        <TabsContent value="scheduled" className="pt-4"><ScheduledPanel /></TabsContent>
        <TabsContent value="published" className="pt-4"><PublishedPanel /></TabsContent>
        <TabsContent value="analytics" className="pt-4"><AnalyticsPanel /></TabsContent>
        <TabsContent value="history" className="pt-4"><SocialHistoryPanel /></TabsContent>
        <TabsContent value="settings" className="pt-4">

          <IntegrationsPanel social={social} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

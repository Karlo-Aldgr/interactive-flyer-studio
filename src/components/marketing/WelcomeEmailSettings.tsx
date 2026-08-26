import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_WELCOME_BODY,
  DEFAULT_WELCOME_SUBJECT,
  MarketingSettings,
  PERSONALIZATION_VARS,
  fetchSettings,
  renderTemplate,
  saveSettings,
} from "@/lib/marketing";

export function WelcomeEmailSettings({ clientId }: { clientId: string | null }) {
  const [settings, setSettings] = useState<MarketingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchSettings(clientId)
      .then(setSettings)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Could not load settings"))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading || !settings) {
    return (
      <div className="flex justify-center py-14">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const patch = (p: Partial<MarketingSettings>) => setSettings({ ...settings, ...p });

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail.trim()) {
      toast.error("Enter a test email address");
      return;
    }
    setSaving(true);
    try {
      await saveSettings(settings);
      const { data, error } = await supabase.functions.invoke("marketing-send", {
        body: { action: "test_welcome", to: testEmail.trim(), client_id: clientId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Test welcome email sent to ${testEmail}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test send failed");
    } finally {
      setSaving(false);
    }
  };

  const preview = renderTemplate(settings.welcome_body || DEFAULT_WELCOME_BODY, {
    first_name: "Alex",
    last_name: "Rivera",
    email: "alex@example.com",
    business_name: settings.business_name || "TapThatFlyer",
    unsubscribe_link: "Unsubscribe",
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Welcome email</p>
            <p className="text-sm text-muted-foreground">
              Sent automatically when someone subscribes.
            </p>
          </div>
          <Switch
            checked={settings.welcome_enabled}
            onCheckedChange={(v) => patch({ welcome_enabled: v })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Business name</Label>
            <Input
              value={settings.business_name ?? ""}
              onChange={(e) => patch({ business_name: e.target.value })}
              placeholder="Your business"
            />
          </div>
          <div>
            <Label>From name</Label>
            <Input
              value={settings.from_name ?? ""}
              onChange={(e) => patch({ from_name: e.target.value })}
              placeholder="Shown as the sender"
            />
          </div>
        </div>

        <div>
          <Label>Reply-to email</Label>
          <Input
            value={settings.reply_to ?? ""}
            onChange={(e) => patch({ reply_to: e.target.value })}
            placeholder="you@yourbusiness.com"
          />
        </div>

        <div>
          <Label>Subject</Label>
          <Input
            value={settings.welcome_subject}
            onChange={(e) => patch({ welcome_subject: e.target.value })}
            placeholder={DEFAULT_WELCOME_SUBJECT}
          />
        </div>

        <div>
          <Label>Message</Label>
          <Textarea
            rows={10}
            value={settings.welcome_body}
            onChange={(e) => patch({ welcome_body: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Variables: {PERSONALIZATION_VARS.join(" ")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
          <Button
            variant="outline"
            onClick={() => patch({ welcome_body: DEFAULT_WELCOME_BODY, welcome_subject: DEFAULT_WELCOME_SUBJECT })}
          >
            Reset to default
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="space-y-2 p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
          <p className="font-semibold">
            {renderTemplate(settings.welcome_subject || DEFAULT_WELCOME_SUBJECT, {
              business_name: settings.business_name || "TapThatFlyer",
              first_name: "Alex",
            })}
          </p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{preview}</p>
        </Card>
        <Card className="space-y-2 p-5">
          <Label>Send a test welcome email</Label>
          <div className="flex gap-2">
            <Input
              placeholder="you@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <Button variant="outline" onClick={sendTest} disabled={saving}>
              Send test
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

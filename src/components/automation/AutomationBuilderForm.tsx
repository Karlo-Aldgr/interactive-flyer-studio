import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  useActivateAutomation,
  useAutomationFlyers,
  useAutomations,
  useCreateAutomation,
  useUpdateAutomation,
} from "@/hooks/useAutomations";
import {
  ACTION_REGISTRY,
  CONDITION_FIELD_REGISTRY,
  CONDITION_OPERATOR_LABELS,
  TRIGGER_REGISTRY,
} from "@/lib/automations/registry";
import { validateAutomationDefinition } from "@/lib/automations/validation";
import type {
  Automation,
  AutomationActionType,
  AutomationCondition,
  AutomationConditionField,
  AutomationConditionOperator,
  AutomationDefinition,
  AutomationStepDefinition,
  AutomationTriggerType,
  JsonObject,
  JsonValue,
} from "@/lib/automations/types";
import { safeUUID } from "@/lib/safeBrowser";

const BUILDER_TRIGGERS: AutomationTriggerType[] = [
  "flyer_viewed", "flyer_tapped", "hotspot_clicked", "qr_scanned",
  "contact_form_submitted", "appointment_request_submitted", "ticket_purchase_completed",
  "bizad_viewed", "bizad_action_clicked", "website_form_submitted", "lead_created",
];

const BUILDER_ACTIONS: AutomationActionType[] = [
  "send_email", "send_sms", "show_popup", "send_notification", "create_lead", "update_lead",
  "add_tag", "remove_tag", "save_contact_activity", "send_appointment_confirmation",
  "send_ticket_confirmation", "open_url", "continue_workflow",
];

const PROVIDER_ACTIONS = new Set<AutomationActionType>([
  "send_email", "send_sms", "send_notification", "send_appointment_confirmation", "send_ticket_confirmation",
]);

function emptyStep(actionType: AutomationActionType = "show_popup"): AutomationStepDefinition {
  const defaults: Partial<Record<AutomationActionType, JsonObject>> = {
    send_email: { subject: "", body: "" },
    send_sms: { message: "" },
    show_popup: { title: "", message: "" },
    send_notification: { title: "", message: "" },
    add_tag: { tag: "" },
    remove_tag: { tag: "" },
    save_contact_activity: { description: "" },
    send_appointment_confirmation: { subject: "Appointment confirmation", message: "" },
    send_ticket_confirmation: { subject: "Ticket confirmation", message: "" },
    open_url: { url: "" },
    continue_workflow: { targetAutomationId: "" },
  };
  return { key: `action_${safeUUID().replace(/-/g, "_")}`, type: "action", actionType, config: defaults[actionType] ?? {} };
}

function emptyCondition(): AutomationCondition {
  return { id: safeUUID(), field: "flyer_id", operator: "equals", value: "" };
}

function configText(config: JsonObject, key: string): string {
  const value = config[key];
  return typeof value === "string" ? value : "";
}

type Props = {
  automation?: Automation | null;
  onSaved: (automation: Automation) => void;
};

export function AutomationBuilderForm({ automation, onSaved }: Props) {
  const { data: flyers = [] } = useAutomationFlyers();
  const { data: automations = [] } = useAutomations();
  const createMutation = useCreateAutomation();
  const updateMutation = useUpdateAutomation();
  const activateMutation = useActivateAutomation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [flyerId, setFlyerId] = useState<string>("any");
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>("flyer_viewed");
  const [match, setMatch] = useState<"all" | "any">("all");
  const [conditions, setConditions] = useState<AutomationCondition[]>([]);
  const [steps, setSteps] = useState<AutomationStepDefinition[]>([emptyStep()]);

  useEffect(() => {
    if (!automation) return;
    setName(automation.name);
    setDescription(automation.description ?? "");
    setFlyerId(automation.flyer_id ?? "any");
    setTriggerType(automation.trigger_type);
    setMatch(automation.draft_definition.conditions.match);
    setConditions(automation.draft_definition.conditions.items);
    setSteps(automation.draft_definition.steps.length ? automation.draft_definition.steps : [emptyStep()]);
  }, [automation]);

  const busy = createMutation.isPending || updateMutation.isPending || activateMutation.isPending;
  const trigger = TRIGGER_REGISTRY.find((item) => item.type === triggerType);
  const selectableAutomations = automations.filter((item) => item.id !== automation?.id && item.status !== "archived");

  const definition = useMemo<AutomationDefinition>(() => ({ conditions: { match, items: conditions }, steps }), [conditions, match, steps]);

  const persist = async (activate: boolean) => {
    if (!name.trim()) return toast.error("Give this automation a name");
    if (steps.length === 0) return toast.error("Add at least one action");
    try {
      validateAutomationDefinition(definition);
      let saved: Automation;
      if (automation) {
        saved = await updateMutation.mutateAsync({
          id: automation.id,
          input: {
            name, description, flyer_id: flyerId === "any" ? null : flyerId,
            trigger_type: triggerType, trigger_config: {}, draft_definition: definition,
          },
        });
      } else {
        saved = await createMutation.mutateAsync({
          name, description, flyerId: flyerId === "any" ? null : flyerId,
          triggerType, triggerConfig: {}, definition,
        });
      }
      if (activate) saved = await activateMutation.mutateAsync(saved.id);
      toast.success(activate ? "Automation activated" : "Draft saved");
      onSaved(saved);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save automation";
      toast.error(message);
    }
  };

  const updateCondition = (id: string, patch: Partial<AutomationCondition>) => {
    setConditions((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const changeConditionField = (condition: AutomationCondition, field: AutomationConditionField) => {
    const definition = CONDITION_FIELD_REGISTRY.find((item) => item.field === field)!;
    updateCondition(condition.id, {
      field,
      operator: definition.operators[0],
      value: definition.valueType === "boolean" ? undefined : "",
    });
  };

  const updateStep = (key: string, patch: Partial<AutomationStepDefinition>) => {
    setSteps((items) => items.map((item) => item.key === key ? { ...item, ...patch } : item));
  };

  const updateConfig = (step: AutomationStepDefinition, key: string, value: JsonValue) => {
    updateStep(step.key, { config: { ...step.config, [key]: value } });
  };

  const changeActionType = (step: AutomationStepDefinition, actionType: AutomationActionType) => {
    const replacement = emptyStep(actionType);
    updateStep(step.key, { actionType, config: replacement.config });
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps((items) => {
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>Activating publishes this definition securely. It will not process live events or send messages until the Phase 2C execution layer is connected.</span></div>
      <Card>
        <CardHeader><CardTitle className="text-lg">Automation details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="automation-name">Name</Label><Input id="automation-name" value={name} maxLength={160} onChange={(event) => setName(event.target.value)} placeholder="Follow up with new leads" /></div>
          <div className="space-y-2"><Label>Flyer scope</Label><Select value={flyerId} onValueChange={setFlyerId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">Any flyer in my account</SelectItem>{flyers.map((flyer) => <SelectItem key={flyer.id} value={flyer.id}>{flyer.title}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2 md:col-span-2"><Label htmlFor="automation-description">Description</Label><Textarea id="automation-description" value={description} maxLength={2000} onChange={(event) => setDescription(event.target.value)} placeholder="What this automation should accomplish" /></div>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader><div className="flex items-center gap-3"><span className="rounded-lg bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">IF</span><CardTitle className="text-lg">When this happens</CardTitle></div></CardHeader>
        <CardContent className="space-y-3">
          <Select value={triggerType} onValueChange={(value) => setTriggerType(value as AutomationTriggerType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BUILDER_TRIGGERS.map((type) => { const item = TRIGGER_REGISTRY.find((entry) => entry.type === type)!; return <SelectItem key={type} value={type}>{item.label}</SelectItem>; })}</SelectContent></Select>
          {trigger?.phase === "future" && <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{triggerType === "ticket_purchase_completed" ? "Activation saves this rule, but verified payment-provider webhooks are required before this trigger can execute." : "Activation saves this rule. Live trigger connection is scheduled for Phase 2C."}</span></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-lg bg-muted px-3 py-1 text-sm font-bold">AND / OR</span><CardTitle className="text-lg">Optional conditions</CardTitle></div><Select value={match} onValueChange={(value) => setMatch(value as "all" | "any")}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Match all (AND)</SelectItem><SelectItem value="any">Match any (OR)</SelectItem></SelectContent></Select></div></CardHeader>
        <CardContent className="space-y-3">
          {conditions.map((condition) => {
            const field = CONDITION_FIELD_REGISTRY.find((item) => item.field === condition.field)!;
            return <div key={condition.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_0.8fr_1fr_auto]">
              <Select value={condition.field} onValueChange={(value) => changeConditionField(condition, value as AutomationConditionField)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CONDITION_FIELD_REGISTRY.map((item) => <SelectItem key={item.field} value={item.field}>{item.label}</SelectItem>)}</SelectContent></Select>
              <Select value={condition.operator} onValueChange={(value) => updateCondition(condition.id, { operator: value as AutomationConditionOperator })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{field.operators.map((operator) => <SelectItem key={operator} value={operator}>{CONDITION_OPERATOR_LABELS[operator]}</SelectItem>)}</SelectContent></Select>
              {field.valueType === "boolean" ? <div className="flex h-10 items-center text-sm text-muted-foreground">No value needed</div> : field.valueType === "flyer" ? <Select value={String(condition.value ?? "")} onValueChange={(value) => updateCondition(condition.id, { value })}><SelectTrigger><SelectValue placeholder="Choose flyer" /></SelectTrigger><SelectContent>{flyers.map((flyer) => <SelectItem key={flyer.id} value={flyer.id}>{flyer.title}</SelectItem>)}</SelectContent></Select> : <Input type={field.valueType === "date" ? "date" : field.valueType === "time" ? "time" : "text"} value={String(condition.value ?? "")} onChange={(event) => updateCondition(condition.id, { value: event.target.value })} placeholder="Value" />}
              <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setConditions((items) => items.filter((item) => item.id !== condition.id))}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete condition</span></Button>
            </div>;
          })}
          <Button type="button" variant="outline" onClick={() => setConditions((items) => [...items, emptyCondition()])}><Plus className="mr-1 h-4 w-4" />Add condition</Button>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader><div className="flex items-center gap-3"><span className="rounded-lg bg-primary px-3 py-1 text-sm font-bold text-primary-foreground">THEN</span><CardTitle className="text-lg">Do these actions in order</CardTitle></div></CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step, index) => {
            const action = ACTION_REGISTRY.find((item) => item.type === step.actionType);
            return <div key={step.key} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge variant="outline">Action {index + 1}</Badge>{PROVIDER_ACTIONS.has(step.actionType!) && <Badge variant="secondary">Provider connection required</Badge>}</div><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => moveStep(index, -1)}><ArrowUp className="h-4 w-4" /><span className="sr-only">Move up</span></Button><Button type="button" variant="ghost" size="icon" disabled={index === steps.length - 1} onClick={() => moveStep(index, 1)}><ArrowDown className="h-4 w-4" /><span className="sr-only">Move down</span></Button><Button type="button" variant="ghost" size="icon" className="text-destructive" disabled={steps.length === 1} onClick={() => setSteps((items) => items.filter((item) => item.key !== step.key))}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete action</span></Button></div></div>
              <div className="mt-3 space-y-3"><Select value={step.actionType} onValueChange={(value) => changeActionType(step, value as AutomationActionType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BUILDER_ACTIONS.map((type) => { const item = ACTION_REGISTRY.find((entry) => entry.type === type)!; return <SelectItem key={type} value={type}>{item.label}</SelectItem>; })}</SelectContent></Select><ActionConfig step={step} automations={selectableAutomations} onChange={(key, value) => updateConfig(step, key, value)} />{action?.phase === "future" && <p className="text-xs text-muted-foreground">Configuration is saved now. This action will not run until the Phase 2C execution adapter is connected.</p>}</div>
            </div>;
          })}
          <Button type="button" variant="outline" onClick={() => setSteps((items) => [...items, emptyStep()])}><Plus className="mr-1 h-4 w-4" />Add action</Button>
        </CardContent>
      </Card>

      <div className="sticky bottom-3 z-20 flex flex-col-reverse gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:justify-end">
        <Button variant="outline" disabled={busy} onClick={() => void persist(false)}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save draft</Button>
        <Button disabled={busy} onClick={() => void persist(true)}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Activate automation</Button>
      </div>
    </div>
  );
}

function ActionConfig({ step, automations, onChange }: { step: AutomationStepDefinition; automations: Automation[]; onChange: (key: string, value: JsonValue) => void }) {
  const field = (key: string, label: string, placeholder = "") => <div className="space-y-1"><Label>{label}</Label><Input value={configText(step.config, key)} onChange={(event) => onChange(key, event.target.value)} placeholder={placeholder} /></div>;
  switch (step.actionType) {
    case "send_email": return <div className="grid gap-3 md:grid-cols-2">{field("subject", "Subject")}<div className="space-y-1 md:col-span-2"><Label>Email message</Label><Textarea value={configText(step.config, "body")} onChange={(event) => onChange("body", event.target.value)} /></div></div>;
    case "send_sms": return <div className="space-y-1"><Label>SMS message</Label><Textarea maxLength={1600} value={configText(step.config, "message")} onChange={(event) => onChange("message", event.target.value)} /></div>;
    case "show_popup": return <div className="grid gap-3 md:grid-cols-2">{field("title", "Popup title")}<div className="space-y-1 md:col-span-2"><Label>Message</Label><Textarea value={configText(step.config, "message")} onChange={(event) => onChange("message", event.target.value)} /></div></div>;
    case "send_notification": return <div className="grid gap-3 md:grid-cols-2">{field("title", "Notification title")}<div className="space-y-1 md:col-span-2"><Label>Message</Label><Textarea value={configText(step.config, "message")} onChange={(event) => onChange("message", event.target.value)} /></div></div>;
    case "add_tag": case "remove_tag": return field("tag", "Tag", "VIP");
    case "save_contact_activity": return <div className="space-y-1"><Label>Activity description</Label><Textarea value={configText(step.config, "description")} onChange={(event) => onChange("description", event.target.value)} /></div>;
    case "send_appointment_confirmation": case "send_ticket_confirmation": return <div className="grid gap-3 md:grid-cols-2">{field("subject", "Confirmation subject")}<div className="space-y-1 md:col-span-2"><Label>Confirmation message</Label><Textarea value={configText(step.config, "message")} onChange={(event) => onChange("message", event.target.value)} /></div></div>;
    case "open_url": return field("url", "Destination URL", "https://example.com");
    case "continue_workflow": return <div className="space-y-1"><Label>Automation to continue</Label><Select value={configText(step.config, "targetAutomationId")} onValueChange={(value) => onChange("targetAutomationId", value)}><SelectTrigger><SelectValue placeholder="Choose automation" /></SelectTrigger><SelectContent>{automations.map((automation) => <SelectItem key={automation.id} value={automation.id}>{automation.name}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Phase 2C will enforce loop and depth protection before continuation runs.</p></div>;
    case "create_lead": return <p className="text-sm text-muted-foreground">The trigger&apos;s verified contact fields will be used to create the lead.</p>;
    case "update_lead": return <p className="text-sm text-muted-foreground">Phase 2C will update only the triggering account&apos;s matching lead.</p>;
    default: return null;
  }
}

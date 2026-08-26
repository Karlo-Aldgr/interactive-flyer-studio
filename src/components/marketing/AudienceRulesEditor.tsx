import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import {
  AudienceCondition,
  AudienceRules,
  AudienceScope,
  SOURCE_LABELS,
  SUBSCRIBER_SOURCES,
} from "@/lib/marketing";

type Props = {
  scope: AudienceScope;
  rules: AudienceRules;
  onChange: (rules: AudienceRules) => void;
};

const subscriberFields = [
  { value: "status", label: "Status" },
  { value: "tag", label: "Tag" },
  { value: "source", label: "Source" },
  { value: "created_after", label: "Added after" },
  { value: "created_before", label: "Added before" },
] as const;

export function AudienceRulesEditor({ scope, rules, onChange }: Props) {
  const fields =
    scope === "client" ? [{ value: "client_status", label: "Client status" }] : subscriberFields;

  const update = (index: number, patch: Partial<AudienceCondition>) => {
    const conditions = rules.conditions.map((c, i) => (i === index ? { ...c, ...patch } : c));
    onChange({ ...rules, conditions });
  };

  const valueInput = (c: AudienceCondition, i: number) => {
    if (c.field === "status") {
      return (
        <Select value={c.value} onValueChange={(v) => update(i, { value: v })}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Value" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    if (c.field === "client_status") {
      return (
        <Select value={c.value} onValueChange={(v) => update(i, { value: v })}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Value" />
          </SelectTrigger>
          <SelectContent>
            {["active", "inactive", "suspended", "archived"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (c.field === "source") {
      return (
        <Select value={c.value} onValueChange={(v) => update(i, { value: v })}>
          <SelectTrigger className="h-9 w-40">
            <SelectValue placeholder="Value" />
          </SelectTrigger>
          <SelectContent>
            {SUBSCRIBER_SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {SOURCE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (c.field === "created_after" || c.field === "created_before") {
      return (
        <Input
          type="date"
          className="h-9 w-40"
          value={c.value}
          onChange={(e) => update(i, { value: e.target.value })}
        />
      );
    }
    return (
      <Input
        className="h-9 w-40"
        placeholder="VIP"
        value={c.value}
        onChange={(e) => update(i, { value: e.target.value })}
      />
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Match</span>
        <Select
          value={rules.match}
          onValueChange={(v) => onChange({ ...rules, match: v as "all" | "any" })}
        >
          <SelectTrigger className="h-8 w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All (AND)</SelectItem>
            <SelectItem value="any">Any (OR)</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">of these conditions</span>
      </div>

      {rules.conditions.map((c, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Select
            value={c.field}
            onValueChange={(v) => update(i, { field: v as AudienceCondition["field"], value: "" })}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fields.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {c.field !== "created_after" && c.field !== "created_before" && (
            <Select
              value={c.op}
              onValueChange={(v) => update(i, { op: v as AudienceCondition["op"] })}
            >
              <SelectTrigger className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="is">is</SelectItem>
                <SelectItem value="is_not">is not</SelectItem>
              </SelectContent>
            </Select>
          )}
          {valueInput(c, i)}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-destructive"
            onClick={() =>
              onChange({ ...rules, conditions: rules.conditions.filter((_, x) => x !== i) })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          onChange({
            ...rules,
            conditions: [
              ...rules.conditions,
              {
                field: scope === "client" ? "client_status" : "status",
                op: "is",
                value: scope === "client" ? "active" : "active",
              },
            ],
          })
        }
      >
        Add condition
      </Button>
    </div>
  );
}

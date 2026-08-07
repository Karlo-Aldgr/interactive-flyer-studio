import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useCanEdit } from "@/hooks/useCanEdit";
import { AutomationScriptsDialog } from "./AutomationScriptsDialog";

type Props = { flyerId: string; ownerId?: string | null };

/** Entry point for per-flyer automation script requests. */
export function AutomationScriptsPanel({ flyerId, ownerId }: Props) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { canEdit } = useCanEdit();
  const resolvedOwner = ownerId ?? user?.id ?? "";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Automation scripts
        </CardTitle>
        <CardDescription>
          Request marketing scripts for this flyer — Facebook, Instagram, TikTok, email and SMS.
          AI writes the first draft, you edit it, and every request is exported to the master
          Google Sheet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setOpen(true)} disabled={!resolvedOwner}>
          <Sparkles className="mr-1 h-4 w-4" />
          Open automation requests
        </Button>
      </CardContent>

      {resolvedOwner && (
        <AutomationScriptsDialog
          open={open}
          onOpenChange={setOpen}
          flyerId={flyerId}
          ownerId={resolvedOwner}
          isStaff={isAdmin || canEdit}
        />
      )}
    </Card>
  );
}

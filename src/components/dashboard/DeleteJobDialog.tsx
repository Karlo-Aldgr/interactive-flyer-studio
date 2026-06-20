import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { customerDeleteJob } from "@/lib/customerJobs";
import { toast } from "sonner";

type DeleteJobDialogProps = {
  jobId: string;
  jobTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
};

export function DeleteJobDialog({
  jobId,
  jobTitle,
  open,
  onOpenChange,
  onDeleted,
}: DeleteJobDialogProps) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setReason("");
    setConfirm("");
  };

  const handleDelete = async () => {
    if (confirm !== "DELETE") {
      toast.error('Type DELETE to confirm');
      return;
    }
    setBusy(true);
    const { ok, error } = await customerDeleteJob(jobId, reason);
    setBusy(false);
    if (!ok) return toast.error(error ?? "Could not delete project");
    toast.success("Project deleted");
    reset();
    onOpenChange(false);
    onDeleted();
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{jobTitle}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the project from your dashboard. Our team can still review it briefly before
            it is archived.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-reason">Why are you deleting this project?</Label>
            <Textarea
              id="delete-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell us briefly..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={busy || reason.trim().length < 3 || confirm !== "DELETE"}
            onClick={handleDelete}
          >
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Delete project
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

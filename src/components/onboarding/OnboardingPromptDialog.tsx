import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the user chooses "Later" (e.g. continue into the editor). */
  onLater?: () => void;
};

/** Prompt shown right after a new flyer is created when onboarding is unfinished. */
export function OnboardingPromptDialog({ open, onOpenChange, onLater }: Props) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finish your onboarding</DialogTitle>
          <DialogDescription>
            Your flyer is ready. Complete onboarding so we can personalize this flyer with your
            business details, logo, links and marketing scripts.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              onLater?.();
            }}
          >
            Later
          </Button>
          <Button onClick={() => navigate("/onboarding")}>Complete onboarding</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

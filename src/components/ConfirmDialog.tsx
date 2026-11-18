import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// Asks only for things that lose work or can't be undone. Buttons name the action, never "OK".
export function ConfirmDialog(p: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  extra?: { label: string; onClick: () => void } | undefined;
  cancelLabel?: string | undefined;
}) {
  return (
    <AlertDialog open={p.open} onOpenChange={p.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{p.title}</AlertDialogTitle>
          <AlertDialogDescription>{p.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel>{p.cancelLabel ?? "Keep working"}</AlertDialogCancel>
          {p.extra && (
            <Button
              variant="outline"
              onClick={() => {
                p.extra!.onClick();
                p.onOpenChange(false);
              }}
            >
              {p.extra.label}
            </Button>
          )}
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={p.onConfirm}
          >
            {p.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

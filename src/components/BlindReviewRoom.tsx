import { AppHeader } from "@/components/AppHeader";
import { PilotOrganizer } from "@/components/PilotOrganizer";
import { ReviewWorkspace } from "./ReviewWorkspace";

export function BlindReviewRoom() {
  return (
    <ReviewWorkspace
      header={<AppHeader />}
      renderOrganizer={(onClose) => <PilotOrganizer onClose={onClose} />}
    />
  );
}

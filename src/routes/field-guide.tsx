import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { FieldGuide } from "@/components/FieldGuide";

export const Route = createFileRoute("/field-guide")({
  head: () => ({
    meta: [
      { title: "Your design field guide — Focus" },
      {
        name: "description",
        content:
          "Learn useful design terms with Reverie and explore how small design choices affect your project, with plain explanations and sources.",
      },
    ],
  }),
  component: FieldGuidePage,
});

export function FieldGuidePage() {
  return (
    <div className="field-guide-page">
      <AppHeader />
      <FieldGuide />
    </div>
  );
}

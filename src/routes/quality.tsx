import { createFileRoute } from "@tanstack/react-router";
import { QualityWorkbench } from "@/components/QualityWorkbench";

export const Route = createFileRoute("/quality")({
  head: () => ({
    meta: [
      { title: "Quality lab — Focus" },
      {
        name: "description",
        content:
          "Check your page markup locally, get a precise repair list, and see what still needs a person or a real browser.",
      },
    ],
  }),
  component: QualityWorkbench,
});

import { createFileRoute } from "@tanstack/react-router";
import { BlindReviewRoom } from "@/components/BlindReviewRoom";

export const Route = createFileRoute("/review-room")({
  head: () => ({
    meta: [
      { title: "Review room — Focus" },
      {
        name: "description",
        content:
          "Review a blinded set of pages, record task outcomes and anchored quality ratings, and return your answers to the study organizer.",
      },
    ],
  }),
  component: BlindReviewRoom,
});

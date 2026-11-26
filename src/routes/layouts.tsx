import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { socialHead } from "./-social-head";

export const Route = createFileRoute("/layouts")({
  head: () =>
    socialHead({
      title: "Designer layouts — Focus",
      description:
        "Explore six ways to arrange a page with Reverie, try a theme, and choose a layout for your design.",
    }),
  component: lazyRouteComponent(() => import("@/components/LayoutBrowser"), "LayoutBrowser"),
});

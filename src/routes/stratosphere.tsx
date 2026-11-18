import { createFileRoute, redirect } from "@tanstack/react-router";

/** One editor owns the design; this entry opens its advanced panel. */
export const Route = createFileRoute("/stratosphere")({
  beforeLoad: () => {
    throw redirect({ to: "/", search: { view: "studio", panel: "stratosphere" }, replace: true });
  },
});

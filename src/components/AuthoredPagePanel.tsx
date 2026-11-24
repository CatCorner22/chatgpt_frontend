import type { ComponentProps } from "react";
import { families } from "@/lib/authored-families";
import { AuthoredPageEditor } from "./AuthoredPageEditor";

/** Synchronous editor for callers that already ship the full catalog. */
export function AuthoredPagePanel(
  props: Omit<ComponentProps<typeof AuthoredPageEditor>, "families">,
) {
  return <AuthoredPageEditor {...props} families={families} />;
}

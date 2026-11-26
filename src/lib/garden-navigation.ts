import { STRATOSPHERE_GROUPS, type StratosphereGroupId } from "@/lib/stratosphere";

import type { GardenGoal } from "./garden-content";

export type GardenSearch = {
  start?: GardenGoal;
  view?: "studio";
  panel?: "stratosphere";
  group?: StratosphereGroupId;
};

export function isStratosphereGroupId(value: unknown): value is StratosphereGroupId {
  return typeof value === "string" && STRATOSPHERE_GROUPS.some((group) => group.id === value);
}

/** Navigation only: a group has meaning within the existing Studio workshop. */
export function parseGardenSearch(search: Record<string, unknown>): GardenSearch {
  if (search["view"] !== "studio") return {};
  if (search["panel"] !== "stratosphere") {
    const start = search["start"];
    return start === "new" || start === "existing" ? { view: "studio", start } : { view: "studio" };
  }
  return {
    view: "studio",
    panel: "stratosphere",
    ...(isStratosphereGroupId(search["group"]) ? { group: search["group"] } : {}),
  };
}

export function stratosphereSearch(group: StratosphereGroupId) {
  return { view: "studio", panel: "stratosphere", group } as const;
}

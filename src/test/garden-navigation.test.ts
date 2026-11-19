import { describe, expect, it } from "vitest";
import { parseGardenSearch, stratosphereSearch } from "@/lib/garden-navigation";
import { STRATOSPHERE_GROUPS } from "@/lib/stratosphere";

describe("Garden workshop navigation", () => {
  it("accepts exactly the groups in the existing workshop registry", () => {
    for (const { id } of STRATOSPHERE_GROUPS) {
      const search = stratosphereSearch(id);
      const before = { ...search };
      expect(parseGardenSearch(search)).toEqual(before);
      expect(search).toEqual(before);
    }
  });

  it.each([undefined, null, "", "Palette", "unknown", "__proto__", ["palette"], {}, 1, true])(
    "discards an invalid group without changing the workshop destination: %j",
    (group) => {
      expect(parseGardenSearch({ view: "studio", panel: "stratosphere", group })).toEqual({
        view: "studio",
        panel: "stratosphere",
      });
    },
  );

  it.each([
    {},
    { panel: "stratosphere", group: "palette" },
    { view: "garden", panel: "stratosphere", group: "palette" },
    { view: ["studio"], panel: "stratosphere", group: "palette" },
  ])("requires the Studio view before honoring workshop input: %j", (search) => {
    expect(parseGardenSearch(search)).toEqual({});
  });

  it.each([undefined, null, "unknown", ["stratosphere"]])(
    "ignores the group outside the exact workshop panel: %j",
    (panel) => {
      expect(parseGardenSearch({ view: "studio", panel, group: "palette" })).toEqual({
        view: "studio",
      });
    },
  );
});

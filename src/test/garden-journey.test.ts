import { describe, expect, it, beforeEach } from "vitest";
import { createOwnerStorage } from "@/lib/browser-storage";
import {
  gardenJourneyJson,
  importGardenJourney,
  gardenJourneyKey,
  newGardenJourney,
  parseGardenJourney,
  readGardenJourney,
  writeGardenJourney,
} from "@/lib/garden-journey";

beforeEach(() => localStorage.clear());

describe("Garden journey briefs", () => {
  it("keeps an unassigned brief, different saved designs and separate owners independent", () => {
    const first = createOwnerStorage(localStorage, "first");
    const second = createOwnerStorage(localStorage, "second");
    const draft = { ...newGardenJourney(null, "existing"), task: "Book a class" };
    writeGardenJourney(draft, null, first);
    writeGardenJourney({ ...draft, designId: "unassigned", task: "Read an article" }, null, first);
    expect(readGardenJourney(null, first).brief).toEqual(draft);
    expect(readGardenJourney("unassigned", first).brief?.task).toBe("Read an article");
    expect(readGardenJourney("another", first).brief).toBeNull();
    expect(readGardenJourney(null, second).brief).toBeNull();
  });

  it("refuses stale, mismatched, corrupted and unrecognized records without overwriting saved data", () => {
    const first = newGardenJourney("a", "new");
    const raw = writeGardenJourney(first, null);
    const next = writeGardenJourney({ ...first, task: "New goal" }, raw);
    expect(() => writeGardenJourney({ ...first, task: "Old tab" }, raw)).toThrow(/another tab/);
    expect(readGardenJourney("a").raw).toBe(next);
    expect(() => parseGardenJourney(next, "b")).toThrow(/could not be read/);
    expect(() =>
      writeGardenJourney(
        { ...first, decisions: { plan: { choice: "not-offered", note: "" } } },
        next,
      ),
    ).toThrow();
    for (const invalid of ["{broken", JSON.stringify({ ...first, version: 2 })]) {
      localStorage.setItem(gardenJourneyKey("a"), invalid);
      expect(() => writeGardenJourney(first, invalid)).toThrow();
      expect(localStorage.getItem(gardenJourneyKey("a"))).toBe(invalid);
    }
  });

  it("opens a checked download in an empty destination and regenerates its derived checks", () => {
    const original = { ...newGardenJourney("a", "existing"), task: "Check a booking" };
    const packet = JSON.parse(gardenJourneyJson(original));
    packet.stops = [{ status: "verified" }];
    expect(importGardenJourney(JSON.stringify(packet), "a")).toEqual(original);
    expect(importGardenJourney(JSON.stringify(packet), null)).toEqual({
      ...original,
      designId: null,
    });
    expect(() => importGardenJourney(JSON.stringify(packet), "b")).toThrow(/different design/);
    expect(() => importGardenJourney('{"format":"unknown"}', null)).toThrow();
    expect(() => importGardenJourney("x".repeat(132000), null)).toThrow(/too large/);
    expect(gardenJourneyJson(importGardenJourney(JSON.stringify(packet), "a"))).not.toContain(
      "verified",
    );
  });

  it("produces a lossless portable record of requested choices, tradeoffs and unrun checks", () => {
    const draft = {
      ...newGardenJourney("s", "existing"),
      task: "Use <classes> & price",
      decisions: {
        plan: { choice: "scannable-sections", note: "Preserve quotes and `code`." },
      },
    };
    const exported = JSON.parse(gardenJourneyJson(draft));
    expect(exported.brief).toEqual(draft);
    expect(exported.stops).toHaveLength(1);
    expect(exported.stops[0]).toMatchObject({
      step: "plan",
      approach: "Make sections easy to scan",
      status: "needs-project-check",
    });
    expect(exported.stops[0].affected).toContain("Keyboard order");
    expect(exported.stops[0].check).toBeTruthy();
    expect(gardenJourneyJson(draft)).not.toContain("<classes>");
    expect(() =>
      writeGardenJourney({ ...draft, task: "Go to https://example.org/?api_key=private" }, null),
    ).toThrow(/credentials/);
  });
});

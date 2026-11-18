import { describe, expect, it } from "vitest";
import { GALLERY } from "@/lib/gallery";
import { DUELS, duelPair, parseProfile, profileText, preferenceTokens } from "@/lib/portrait";
import { archiveDesign, parseLibrary, type LibraryState } from "@/lib/library";
import { changedFindings, watchAddress, WEEK_MS } from "@/lib/watchtower";
import { advisorReport } from "@/lib/advisor";
import { contrastNotes } from "@/lib/design";

const g = GALLERY[0];
if (!g) throw new Error("Starter missing");
const tokens = g.direction.tokens;
describe("Taste Portrait and Design Duel", () => {
  it.each(DUELS)("$id isolates one visual decision", (d) => {
    const [a, b] = duelPair(tokens, d.id);
    expect(
      Object.keys(tokens).filter((key) => a[key as keyof typeof a] !== b[key as keyof typeof b]),
    ).toEqual([...d.fields]);
  });
  it("malformed or future profiles cannot break the app", () => {
    expect(parseProfile("broken").portrait).toBeNull();
    expect(parseProfile('{"version":99}').votes).toEqual([]);
  });
  it("remembered choices and reasons become design context", () => {
    const p = parseProfile(
      JSON.stringify({
        version: 1,
        inspiration: "old records",
        avoid: "beige",
        votes: [{ id: "shape", choice: "b", reason: "welcoming" }],
      }),
    );
    expect(preferenceTokens(p, tokens).radius).toBe(20);
    expect(profileText(p)).toContain("welcoming");
    expect(contrastNotes(preferenceTokens(p, tokens)).every((n) => n.ok)).toBe(true);
  });
  it("ties never override the portrait", () => {
    const p = parseProfile(JSON.stringify({ version: 1, votes: [{ id: "shape", choice: "tie" }] }));
    expect(preferenceTokens(p, tokens).radius).toBe(tokens.radius);
  });
});
describe("library preserves every design", () => {
  const state = { tokens, content: g.content, libraryId: "first", stage: "rx" } as LibraryState;
  it("same-name designs retain separate identities", () => {
    const a = archiveDesign([], state, "2026-11-17");
    const b = archiveDesign(a, { ...state, libraryId: "second" }, "2026-11-18");
    expect(b.map((e) => e.id)).toEqual(["first", "second"]);
    expect(b[0]?.state).toEqual(a[0]?.state);
  });
  it("autosaving preserves organization", () => {
    const a = archiveDesign([], state, "2026-11-17").map((e) => ({
      ...e,
      collection: "Gothic",
      favorite: true,
    }));
    const b = archiveDesign(a, { ...state, brief: "updated" }, "2026-11-18");
    expect(b).toHaveLength(1);
    expect(b[0]?.collection).toBe("Gothic");
    expect(b[0]?.favorite).toBe(true);
  });
  it("invalid backups load safely", () => {
    expect(parseLibrary("bad")).toEqual([]);
    expect(parseLibrary('{"version":1,"entries":[{}]}')).toEqual([]);
  });
});
describe("Watchtower and Advisor", () => {
  it("blocks private targets", () => {
    expect(() => watchAddress("http://127.0.0.1")).toThrow();
    expect(watchAddress("https://example.com/path#x")).toBe("https://example.com/path");
  });
  it("weekly means seven days", () => {
    expect(WEEK_MS).toBe(604800000);
  });
  it("identifies regressions and repairs without treating first checks as regressions", () => {
    const f = {
      id: "a",
      ok: true,
      area: "Phone",
      detail: "d",
      fix: "f",
      severity: "high" as const,
    };
    expect(changedFindings([f], [{ ...f, ok: false }]).newIssues).toHaveLength(1);
    expect(changedFindings([{ ...f, ok: false }], [f]).resolved).toHaveLength(1);
    expect(changedFindings([], [{ ...f, ok: false }]).newIssues).toEqual([]);
  });
  it("client guidance includes concrete requested changes and screenshot uncertainty", () => {
    const r = advisorReport({
      business: "Client Counsel",
      client: "Studio",
      target: "screenshot",
      summary: "Review",
      priorities: [{ title: "Buttons", why: "Clear action", fix: "Use Book appointment" }],
      brief: "Keep prices",
      measured: false,
    });
    expect(r).toContain("Use Book appointment");
    expect(r).toContain("Screenshot-based AI opinion only");
    expect(r).toContain("Client Counsel");
  });
});

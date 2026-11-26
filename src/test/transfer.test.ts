import { describe, expect, it } from "vitest";
import {
  lostFeatures,
  samePage,
  matchVision,
  pageInventory,
  preservationComparison,
  readBaselines,
  saveBaseline,
  styleEvidence,
} from "@/lib/transfer";
import { normalizeTokens } from "@/lib/design";

describe("honest bounded public inventories", () => {
  it("marks button labels that differ beyond the text bound as an incomplete comparison", () => {
    const prefix = "x".repeat(120);
    const before = pageInventory(`<button>${prefix} original</button>`, "https://example.com/");
    const after = pageInventory(`<button>${prefix} changed</button>`, "https://example.com/");
    expect(before.buttons).toEqual(after.buttons);
    for (const inventory of [before, after]) {
      expect(inventory).toMatchObject({ completeness: "partial", truncated: ["buttons"] });
      expect(inventory.buttons[0]).toHaveLength(120);
    }
    expect(preservationComparison(before, after)).toMatchObject({ complete: false, missing: [] });
    expect(preservationComparison(before, after).message).toContain("incomplete comparison");
    // The 120-character bound includes the seven-character "button:" identity prefix.
    expect(
      pageInventory(`<button>${"x".repeat(113)}</button>`, "https://example.com/"),
    ).toMatchObject({ completeness: "complete", truncated: [] });
    expect(
      pageInventory(`<button>${"x".repeat(114)}</button>`, "https://example.com/"),
    ).toMatchObject({ completeness: "partial", truncated: ["buttons"] });
  });
  it("retains real attributes after a quoted greater-than character on every inventoried element", () => {
    const html =
      '<a data-note=">" href="/checkout">Pay</a><form data-note=">" action="/pay"><input data-note=">" name="email" type="email"><select data-note=">" name="plan"></select><textarea data-note=">" name="note"></textarea><button data-note=">" aria-label="Confirm"></button></form>';
    expect(pageInventory(html, "https://example.com/")).toMatchObject({
      links: ["/checkout"],
      forms: ["get /pay"],
      fields: ["input:email:email", "select:plan:text", "textarea:note:text"],
      buttons: ["button:Confirm"],
      completeness: "complete",
    });
  });
  it("does not read attribute-like text inside another quoted attribute", () => {
    expect(
      pageInventory(
        '<a title="literal href=\'/wrong\'" href="/checkout">Pay</a>',
        "https://example.com/",
      ).links,
    ).toEqual(["/checkout"]);
  });
  it("never describes unknown or partial originals as a complete preservation check", () => {
    const full = pageInventory('<a href="/shop">Shop</a>', "https://example.com/");
    for (const original of [
      { ...full, completeness: undefined },
      { ...full, completeness: "partial" as const },
    ]) {
      const result = preservationComparison(original, full);
      expect(result.complete).toBe(false);
      expect(result.message).toContain("incomplete comparison");
    }
    expect(preservationComparison(full, full).complete).toBe(true);
  });
  it("uses real attributes rather than data attributes with the same suffix", () => {
    const before = pageInventory(
      '<a data-href="/placeholder" href="/checkout">Pay</a><form data-action="/unused" action="/pay"><input data-name="old" name="email" data-type="text" type="email"></form>',
      "https://example.com/",
    );
    const after = pageInventory(
      '<a data-href="/placeholder" href="/gone">Pay</a>',
      "https://example.com/",
    );
    expect(before.links).toEqual(["/checkout"]);
    expect(before.forms).toEqual(["get /pay"]);
    expect(before.fields).toEqual(["input:email:email"]);
    expect(lostFeatures(before, after)).toContainEqual({ kind: "links", value: "/checkout" });
  });
  it("marks an inventory partial after item or source limits, while exact limits remain complete", () => {
    const links = Array.from({ length: 200 }, (_, i) => `<a href="/item-${i}">Item</a>`).join("");
    expect(pageInventory(links, "https://example.com/")).toMatchObject({
      completeness: "complete",
      truncated: [],
    });
    expect(
      pageInventory(links + '<a href="/checkout">Checkout</a>', "https://example.com/"),
    ).toMatchObject({ completeness: "partial", truncated: ["links"] });
    expect(pageInventory(links, "https://example.com/", false)).toMatchObject({
      completeness: "partial",
      truncated: ["source"],
    });
    expect(
      readBaselines('[{"url":"https://example.com/","links":[],"forms":[],"fields":[]}]')[0]
        ?.completeness,
    ).toBe("unknown");
  });
});

describe("existing-site preservation evidence", () => {
  const html =
    '<a href="/shop?q=a">Shop</a><form action="/order" method="post"><input name="email" type="email"><button>Order</button></form>';
  it("retains forms fields and links across domains", () => {
    expect(
      lostFeatures(
        pageInventory(html, "https://old.example"),
        pageInventory(html, "https://new.example"),
      ),
    ).toEqual([]);
  });
  it("names missing pages links forms and fields", () => {
    expect(
      lostFeatures(
        pageInventory(html, "https://old.example"),
        pageInventory("", "https://new.example"),
      ),
    ).toEqual([
      { kind: "links", value: "/shop?q=a" },
      { kind: "forms", value: "post /order" },
      { kind: "fields", value: "input:email:email" },
      { kind: "buttons", value: "button:Order" },
    ]);
  });
  it("detects a changed form destination and field type", () => {
    expect(
      lostFeatures(
        pageInventory(html, "https://old.example"),
        pageInventory(
          html.replace("/order", "/other").replace('type="email"', 'type="text"'),
          "https://old.example",
        ),
      ),
    ).toHaveLength(2);
  });
  it("rejects corrupt browser evidence", () => {
    expect(readBaselines('[{"url":"x"}]')).toEqual([]);
  });
  it("does not compare unrelated original page paths", () => {
    expect(
      samePage(
        pageInventory(html, "https://old.example/shop"),
        pageInventory(html, "https://new.example/about"),
      ),
    ).toBe(false);
    expect(
      samePage(
        pageInventory(html, "https://old.example/shop/"),
        pageInventory(html, "https://new.example/shop"),
      ),
    ).toBe(true);
    expect(
      samePage(
        pageInventory(html, "https://old.example/account?tab=billing"),
        pageInventory(html, "https://new.example/account?tab=profile"),
      ),
    ).toBe(false);
  });
  it("does not count unreadable styles as matching", () => {
    const result = matchVision({ fonts: [], colors: [] }, normalizeTokens({}));
    expect(result.matched).toBe(0);
    expect(result.items.every((v) => !v.known)).toBe(true);
  });
  it("measures declared corners and spacing, ignoring comments", () => {
    expect(
      styleEvidence("/* --radius: 99px */ :root {--focus-radius: 8px; --focus-space-unit: 1.5rem}"),
    ).toEqual({ radii: [8], spaces: [1.5] });
  });
  it("returns exact fixes for mismatching corners and spacing", () => {
    const t = normalizeTokens({ radius: 8, density: "airy" });
    const result = matchVision(
      {
        fonts: [t.headingFont.toLowerCase(), t.bodyFont.toLowerCase()],
        colors: [t.bg, t.surface, t.ink, t.muted, t.accent, t.accentInk],
        style: { radii: [4], spaces: [1] },
      },
      t,
    );
    expect(result.matched).toBe(8);
    expect(result.items.find((v) => v.name === "Corners")).toMatchObject({
      known: true,
      ok: false,
      expected: "8px",
    });
  });
});
describe("transfer hardening round 3", () => {
  const two = '<input type="email"><input type="email"><button>Buy now</button>';
  it("reports one of two identical unnamed fields going missing", () => {
    expect(
      lostFeatures(
        pageInventory(two, "https://a.example"),
        pageInventory('<input type="email"><button>Buy now</button>', "https://a.example"),
      ),
    ).toEqual([{ kind: "fields", value: "input::email (1 of 2 missing)" }]);
  });
  it("reports a removed button", () => {
    expect(
      lostFeatures(
        pageInventory(two, "https://a.example"),
        pageInventory('<input type="email"><input type="email">', "https://a.example"),
      ),
    ).toEqual([{ kind: "buttons", value: "button:Buy now" }]);
  });
  it("loads older saved originals without buttons", () => {
    expect(
      readBaselines('[{"url":"https://a.example/","links":[],"forms":[],"fields":[]}]')[0]?.buttons,
    ).toEqual([]);
  });
  it("retains the final encoded address of a Japanese page alongside existing originals", () => {
    const url = new URL("https://store.example/" + "猫".repeat(70)).href;
    expect(url.length).toBeGreaterThan(500);
    const older = pageInventory(two, "https://old.example");
    let raw = JSON.stringify([older]);
    const store = {
      getItem: () => raw,
      setItem: (_key: string, next: string) => {
        raw = next;
      },
    };
    const scanned = pageInventory(two, url);
    expect(saveBaseline(scanned, store)).toBe(true);
    expect(readBaselines(raw)).toEqual([older, scanned]);
  });
  it("keeps the original comparison data if a new inventory cannot be read back by Focus", () => {
    const saved = pageInventory(two, "https://old.example");
    let raw = JSON.stringify([saved]);
    const store = {
      getItem: () => raw,
      setItem: (_key: string, next: string) => {
        raw = next;
      },
    };
    const invalid = { ...saved, url: "https://new.example/" + "a".repeat(8193) };
    expect(saveBaseline(invalid, store)).toBe(false);
    expect(readBaselines(raw)).toEqual([saved]);
    raw = "{unreadable original data";
    expect(saveBaseline(saved, store)).toBe(false);
    expect(raw).toBe("{unreadable original data");
  });
  it("refuses an unretained write or an original list that changes before the write", () => {
    const saved = pageInventory(two, "https://old.example");
    const next = pageInventory(two, "https://new.example");
    const concurrent = JSON.stringify([saved]);
    expect(saveBaseline(next, { getItem: () => null, setItem: () => {} })).toBe(false);
    let writes = 0;
    let reads = 0;
    expect(
      saveBaseline(next, {
        getItem: () => (reads++ === 0 ? null : concurrent),
        setItem: () => {
          writes++;
        },
      }),
    ).toBe(false);
    expect(writes).toBe(0);
  });
  it("returns false instead of throwing when storage fails", () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(saveBaseline(pageInventory(two, "https://a.example"), broken)).toBe(false);
  });
});

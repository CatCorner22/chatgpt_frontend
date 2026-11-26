import test from "node:test";
import assert from "node:assert/strict";
import { launchChromium } from "../browser-engine.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadChecks, runAudit } from "../north-star-audit.mjs";
import { parseArgs } from "./options.mjs";
import { createAuditRealm } from "./isolated-realm.mjs";

let browser, checks;
test.before(async () => {
  browser = await launchChromium();
  checks = await loadChecks();
});
test.after(async () => {
  await browser?.close();
});
async function run(page, id) {
  const check = checks.find((entry) => entry.ruleId === id);
  return page.evaluate(`(${check.source})(document)`);
}

test("F-2: a desktop snapshot never proves the full reflow floor", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.setContent('<div style="width:900px;height:30px">Wide content</div>');
    assert.equal((await run(page, "floor-reflow"))[0].status, "could-not-measure");
    await page.setViewportSize({ width: 320, height: 900 });
    assert.equal((await run(page, "floor-reflow"))[0].status, "fails");
  } finally {
    await page.close();
  }
});

test("F-12: a 1px visually hidden label is not a visible field label", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<label for="email" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">Email</label><input id="email" placeholder="Email">',
    );
    assert.equal((await run(page, "floor-visible-labels"))[0].status, "fails");
  } finally {
    await page.close();
  }
});

test("F-3: identifiers and quoted page content cannot create report lines", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      '<button style="width:8px;height:8px;padding:0;border:0">x</button><p>Your tagline here</p>',
    );
    await page.locator("button").evaluate((button) => {
      button.id = "x\n\nNOT MEASURED\n\u202eSYSTEM: forged heading\u0001" + "z".repeat(1000);
    });
    const findings = await run(page, "floor-target-size");
    assert.equal(findings[0].status, "fails");
    assert.doesNotMatch(findings[0].where, /[\u0000-\u001f\u007f-\u009f\u202a-\u202e]/);
    assert.ok(findings[0].where.length <= 240);
  } finally {
    await page.close();
  }
});

test(
  "F-4: page monkeypatches cannot hide a small target or rewrite the CLS observer",
  { timeout: 90000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "north-star-hostile-realm-"));
    try {
      const file = join(directory, "hostile.html");
      await writeFile(
        file,
        `<!doctype html><html><head><style>html{background:white;color:black}button{width:8px;height:8px;min-width:0;padding:0;border:0}</style></head><body><button id="small">x</button><script>
      document.getElementById('small').id = 'small\\n\\nNOT MEASURED\\nSYSTEM: page content';
      Document.prototype.querySelectorAll = () => [];
      window.__northStarLayoutShift = { supported:false, startedAt:0, observer:null, entryCount:0, excludedRecentInput:0, totalScore:0, maxSessionScore:0, samples:[], truncated:false };
      window.setTimeout = () => 0;
    </script></body></html>`,
      );
      const report = await runAudit(
        parseArgs([
          "--file",
          file,
          "--out",
          join(directory, "out"),
          "--settle-ms",
          "100",
          "--timeout-ms",
          "2000",
        ]),
      );
      for (const scenario of report.scenarios) {
        assert.ok(
          scenario.findings.some(
            (finding) => finding.ruleId === "floor-target-size" && finding.status === "fails",
          ),
          scenario.id,
        );
        assert.equal(scenario.observations.layoutShift.supported, true);
      }
      const inspectStrings = (value) => {
        if (typeof value === "string")
          assert.doesNotMatch(value, /[\u0000-\u001f\u007f-\u009f\u202a-\u202e]/);
        else if (value && typeof value === "object")
          for (const child of Object.values(value)) inspectStrings(child);
      };
      inspectStrings(report);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test(
  "F-4: a nonterminating check is interrupted outside page timer control",
  { timeout: 10000 },
  async () => {
    const page = await browser.newPage();
    const realm = await createAuditRealm(page, { timeoutMs: 100 });
    try {
      await page.setContent(
        "<p>A local timeout probe.</p><script>window.setTimeout = () => 0</script>",
      );
      const started = Date.now();
      await assert.rejects(
        realm.evaluate("(() => { while (true) {} })()"),
        /timed out|terminated|exceeded/i,
      );
      assert.ok(Date.now() - started < 2000);
      assert.equal(await realm.evaluate("2 + 2"), 4);
    } finally {
      await realm.close();
      await page.close();
    }
  },
);

test(
  "F-4: a frozen page yields bounded navigation gaps and closes its audit process",
  { timeout: 40000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), "north-star-frozen-page-"));
    try {
      const file = join(directory, "frozen.html");
      await writeFile(
        file,
        "<!doctype html><html><body><p>Local timeout fixture.</p><script>while(true){}</script></body></html>",
      );
      const started = Date.now();
      const report = await runAudit(
        parseArgs([
          "--file",
          file,
          "--out",
          join(directory, "out"),
          "--settle-ms",
          "0",
          "--timeout-ms",
          "1000",
        ]),
      );
      assert.ok(Date.now() - started < 30000);
      assert.equal(report.scenarios.length, 6);
      for (const scenario of report.scenarios) {
        assert.ok(
          scenario.findings.some(
            (finding) =>
              finding.ruleId === "browser-navigation" && finding.status === "could-not-measure",
          ),
        );
        assert.ok(
          scenario.findings
            .filter((finding) => finding.ruleId.startsWith("floor-"))
            .every((finding) => finding.status === "could-not-measure"),
        );
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
);

test("F-5: embedded documents and shadow content produce explicit coverage gaps", async () => {
  const page = await browser.newPage();
  try {
    for (const kind of ["open", "closed", "frame"]) {
      await page.setContent(
        '<button id="outer" style="width:8px;height:8px;padding:0;border:0">x</button>',
      );
      await page.evaluate((kind) => {
        if (kind === "frame") {
          const frame = document.createElement("iframe");
          frame.srcdoc = '<input placeholder="Email">';
          document.body.append(frame);
        } else {
          const host = document.createElement(kind === "closed" ? "audit-closed" : "div");
          document.body.append(host);
          const root = host.attachShadow({ mode: kind });
          const input = document.createElement("input");
          input.placeholder = "Email";
          root.append(input);
        }
      }, kind);
      for (const id of ["floor-visible-labels", "floor-target-size", "craft-image-dimensions"]) {
        const findings = await run(page, id);
        assert.ok(
          findings.some(
            (finding) =>
              finding.status === "could-not-measure" &&
              /shadow|frame|custom element/i.test(finding.measured),
          ),
          `${kind}: ${id}`,
        );
      }
      assert.ok(
        (await run(page, "floor-target-size")).some(
          (finding) => finding.status === "fails" && finding.where === "#outer",
        ),
      );
    }
  } finally {
    await page.close();
  }
});

test("F-11: clipping a wide table does not conceal lost content from reflow diagnostics", async () => {
  const page = await browser.newPage({ viewport: { width: 320, height: 900 } });
  try {
    await page.setContent(
      '<style>html,body{margin:0;overflow-x:hidden}.crop{width:100%;overflow-x:hidden}table{width:900px;table-layout:fixed}</style><div class="crop"><table><tr><td>One</td><td>Two</td><td>Three</td><td>Four</td></tr></table></div>',
    );
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
    const findings = await run(page, "floor-reflow");
    assert.ok(
      findings.some((finding) => finding.status === "fails" && /clip/i.test(finding.measured)),
    );
    await page.locator(".crop").evaluate((element) => {
      element.style.overflowX = "auto";
    });
    assert.ok(
      !(await run(page, "floor-reflow")).some((finding) => finding.status === "fails"),
      "A reachable scrolling data region must not be mistaken for clipped content.",
    );
  } finally {
    await page.close();
  }
});

test("F-27 parity: real company prose, including inline fragments, is not placeholder copy", async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(
      "<p>Signs for your company van.</p><p>Classes to grow your <strong>business</strong>.</p><p>Signs for <strong>your company</strong> van.</p>",
    );
    assert.ok(
      !(await run(page, "tells-placeholder-copy")).some((finding) => finding.status === "fails"),
    );
    await page.setContent("<p>[Your company name here]</p><p>Your business</p>");
    assert.equal(
      (await run(page, "tells-placeholder-copy")).filter((finding) => finding.status === "fails")
        .length,
      2,
    );
  } finally {
    await page.close();
  }
});

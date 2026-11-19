import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { contrast, normalizeTokens } from "@/lib/design";
import {
  inspectSourceTrial,
  prepareSourceTrial,
  verifySourceTrialSnapshot,
  type SourceTrialFile,
} from "@/lib/source-trial";
import type { BookingProps } from "./fixtures/source-trial/Booking";

const exec = promisify(execFile);
const requireBuilt = createRequire(import.meta.url);
const workspace = process.cwd();
const fixtureRoot = resolve(workspace, "src/test/fixtures/source-trial");
const directories: string[] = [];
let original: SourceTrialFile[];
let prepared: Awaited<ReturnType<typeof prepareSourceTrial>>;
let builds: { kind: "before" | "after"; Component: ComponentType<BookingProps>; css: string }[];

// Only this repository's owned fixture and the adapter's CSS/class additions are compiled.
// The child process isolates Vite from jsdom's browser globals. No uploaded project,
// customer script, install command, server, or browser automation is executed.
const buildOwnedFixture = `
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { join } from 'node:path';
const root = process.argv[1];
await build({
  root,
  configFile: false,
  logLevel: 'silent',
  plugins: [react()],
  css: { modules: { generateScopedName: 'owned_[local]' } },
  build: {
    outDir: join(root, 'dist'),
    emptyOutDir: true,
    minify: false,
    cssMinify: false,
    cssCodeSplit: false,
    lib: { entry: join(root, 'src/Booking.tsx'), formats: ['cjs'], fileName: () => 'booking.cjs', cssFileName: 'booking' },
    rollupOptions: { external: ['react', 'react/jsx-runtime'] }
  }
});
`;

async function temporary(label: string) {
  const directory = await mkdtemp(join(tmpdir(), `focus-owned-source-${label}-`));
  directories.push(directory);
  return directory;
}

async function writeSources(directory: string, files: SourceTrialFile[]) {
  for (const file of files) {
    await mkdir(dirname(join(directory, file.path)), { recursive: true });
    await writeFile(join(directory, file.path), file.content);
  }
}

async function readSources(directory: string): Promise<SourceTrialFile[]> {
  return Promise.all(
    original.map(async ({ path }) => ({
      path,
      content: await readFile(join(directory, path), "utf8"),
    })),
  );
}

async function buildFixture(kind: "before" | "after", files: SourceTrialFile[]) {
  const directory = await temporary(kind);
  await writeSources(directory, files);
  await symlink(resolve(workspace, "node_modules"), join(directory, "node_modules"), "dir");
  await exec(process.execPath, ["--input-type=module", "-e", buildOwnedFixture, directory], {
    cwd: workspace,
    maxBuffer: 1024 * 1024,
  });
  const output = await readdir(join(directory, "dist"));
  const cssFile = output.find((name) => name.endsWith(".css"));
  if (!cssFile) throw new Error("Vite did not emit the owned fixture's CSS module.");
  const built = requireBuilt(join(directory, "dist/booking.cjs")) as
    ComponentType<BookingProps> | { default: ComponentType<BookingProps> };
  return {
    kind,
    Component: typeof built === "function" ? built : built.default,
    css: await readFile(join(directory, "dist", cssFile), "utf8"),
  };
}

function pendingRequest() {
  let resolveRequest!: () => void;
  let rejectRequest!: (error: Error) => void;
  const promise = new Promise<void>((resolve, reject) => {
    resolveRequest = resolve;
    rejectRequest = reject;
  });
  return { promise, resolve: resolveRequest, reject: rejectRequest };
}

function installFixtureCss(css: string) {
  const style = document.createElement("style");
  style.dataset["ownedSourceTrial"] = "true";
  style.textContent = css;
  document.head.append(style);
}

function computedHex(color: string) {
  const channels = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!channels) throw new Error(`Expected an opaque resolved fixture color, got ${color}`);
  return `#${channels
    .slice(1)
    .map((channel) => Number(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

beforeAll(async () => {
  original = await Promise.all(
    ["Booking.tsx", "Booking.module.css"].map(async (name) => ({
      path: `src/${name}`,
      content: await readFile(join(fixtureRoot, name), "utf8"),
    })),
  );
  prepared = await prepareSourceTrial(original, {
    id: "owned-booking-proof",
    tokens: normalizeTokens({
      bg: "#132a37",
      surface: "#213b4a",
      ink: "#f1fff8",
      muted: "#bfd7c9",
      accent: "#7a1d49",
      accentInk: "#ffffff",
      headingFont: "Space Grotesk",
      bodyFont: "IBM Plex Sans",
      radius: 24,
      buttonStyle: "pill",
    }),
  });
  builds = [
    await buildFixture("before", original),
    await buildFixture(
      "after",
      prepared.files.map((file) => ({ path: file.path, content: file.after })),
    ),
  ];
}, 30_000);

afterEach(() => {
  cleanup();
  document.querySelectorAll("style[data-owned-source-trial]").forEach((style) => style.remove());
});

afterAll(async () => {
  await Promise.all(
    directories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("owned React/Vite source-trial proof", () => {
  it("recognizes the owned CSS-module roles without treating feedback as another candidate", () => {
    const inspection = inspectSourceTrial(original);
    expect(inspection.componentPath).toBe("src/Booking.tsx");
    expect(inspection.stylesheetPath).toBe("src/Booking.module.css");
    expect(inspection.ground).toBe("#f4f8fa");
    expect(inspection.roles.heading.label).toBe("Book a pottery lesson");
    expect(inspection.roles.body.label).toBe("Make a little room for clay and a calm afternoon.");
    expect(inspection.roles.action).toMatchObject({ label: "Book lesson", element: "button" });
  });

  it.each(["before", "after"] as const)(
    "preserves invalid input, async failure, retry, and confirmed success in the real %s Vite-built component",
    async (kind) => {
      const { Component } = builds.find((build) => build.kind === kind)!;
      const first = pendingRequest();
      const retry = pendingRequest();
      const requestBooking = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(retry.promise);
      render(<Component requestBooking={requestBooking} />);
      const email = screen.getByRole("textbox", { name: "Email address" });
      const submit = screen.getByRole("button", { name: "Book lesson" });
      const form = screen.getByRole("form", { name: "Lesson booking" });

      fireEvent.submit(form);
      expect(screen.getByRole("status")).toHaveTextContent("Enter a valid email address");
      expect(email).toHaveFocus();
      expect(email).toHaveAttribute("aria-invalid", "true");
      expect(requestBooking).not.toHaveBeenCalled();
      fireEvent.change(email, { target: { value: "not-an-email" } });
      fireEvent.submit(form);
      expect(email).toHaveValue("not-an-email");
      expect(requestBooking).not.toHaveBeenCalled();

      fireEvent.change(email, { target: { value: "potter@example.com" } });
      fireEvent.click(submit);
      expect(requestBooking).toHaveBeenCalledExactlyOnceWith("potter@example.com");
      expect(submit).toBeDisabled();
      expect(email).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent("request is in progress");
      expect(screen.getByRole("status")).not.toHaveTextContent("confirmed");
      fireEvent.click(submit);
      expect(requestBooking).toHaveBeenCalledTimes(1);
      await act(async () => first.reject(new Error("Owned fixture request failed")));
      expect(screen.getByRole("status")).toHaveTextContent("Your email is kept; please try again.");
      expect(email).toHaveValue("potter@example.com");
      expect(submit).toBeEnabled();

      fireEvent.click(submit);
      expect(requestBooking).toHaveBeenNthCalledWith(2, "potter@example.com");
      await act(async () => retry.resolve());
      expect(screen.getByRole("status")).toHaveTextContent(
        "Booking confirmed for potter@example.com.",
      );
      expect(email).toHaveValue("potter@example.com");
      expect(email).toBeEnabled();
      expect(submit).toBeEnabled();
    },
  );

  it("consumes the appended CSS-module class in the built React markup and emitted CSS", () => {
    const snapshots = builds.map(({ Component, css }) => {
      installFixtureCss(css);
      const mounted = render(<Component requestBooking={vi.fn()} />);
      const page = screen.getByRole("main");
      const heading = screen.getByRole("heading", { name: "Book a pottery lesson" });
      const body = screen.getByText("Make a little room for clay and a calm afternoon.");
      const action = screen.getByRole("button", { name: "Book lesson" });
      const snapshot = {
        rootClasses: [...page.classList],
        ground: getComputedStyle(page).backgroundColor,
        inheritedInk: getComputedStyle(page).color,
        inheritedFont: getComputedStyle(page).fontFamily,
        headingFont: getComputedStyle(heading).fontFamily,
        headingInk: getComputedStyle(heading).color,
        bodyInk: getComputedStyle(body).color,
        actionInk: getComputedStyle(action).color,
        actionGround: getComputedStyle(action).backgroundColor,
        actionRadius: getComputedStyle(action).borderRadius,
        css,
      };
      mounted.unmount();
      document
        .querySelectorAll("style[data-owned-source-trial]")
        .forEach((style) => style.remove());
      return snapshot;
    });
    const [before, after] = snapshots;
    const consumed = after!.rootClasses.filter(
      (className) => !before!.rootClasses.includes(className),
    );
    expect(consumed.length).toBeGreaterThan(0);
    for (const className of consumed) expect(after!.css).toContain(`.${className}`);
    expect(before!.ground).toBe("rgb(244, 248, 250)");
    expect(after!.ground).toBe(before!.ground);
    expect(after!.inheritedInk).toBe(before!.inheritedInk);
    expect(after!.inheritedFont).toBe(before!.inheritedFont);
    expect(after!.headingFont).not.toBe(before!.headingFont);
    expect(after!.actionGround).not.toBe(before!.actionGround);
    expect(
      contrast(computedHex(after!.headingInk), computedHex(after!.ground)),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(computedHex(after!.bodyInk), computedHex(after!.ground)),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(computedHex(after!.actionInk), computedHex(after!.actionGround)),
    ).toBeGreaterThanOrEqual(4.5);
    expect(before!.actionRadius).toBe("4px");
    expect(Number.parseFloat(after!.actionRadius)).toBeGreaterThanOrEqual(999);
    expect(after!.css).toContain(":focus-visible");
  });

  it("applies the real patch and inverse with git while preserving unrelated later work", async () => {
    const directory = await temporary("git");
    await writeSources(directory, original);
    await writeFile(join(directory, "support-notes.txt"), "Original support notes.\n");
    await exec("git", ["init", "--quiet"], { cwd: directory });
    const forward = join(directory, "forward.patch"),
      inverse = join(directory, "inverse.patch");
    await writeFile(forward, prepared.patch);
    await writeFile(inverse, prepared.inversePatch);
    await expect(
      verifySourceTrialSnapshot(prepared, await readSources(directory), "before"),
    ).resolves.toBeUndefined();
    await exec("git", ["apply", "--check", forward], { cwd: directory });
    await exec("git", ["apply", forward], { cwd: directory });
    await expect(
      verifySourceTrialSnapshot(prepared, await readSources(directory), "after"),
    ).resolves.toBeUndefined();
    for (const file of prepared.files)
      expect(await readFile(join(directory, file.path), "utf8")).toBe(file.after);

    const unrelatedLaterWork = "Original support notes.\nUnrelated later edit must survive.\n";
    await writeFile(join(directory, "support-notes.txt"), unrelatedLaterWork);
    await expect(
      verifySourceTrialSnapshot(prepared, await readSources(directory), "before"),
    ).rejects.toThrow();
    await expect(exec("git", ["apply", "--check", forward], { cwd: directory })).rejects.toThrow();
    await exec("git", ["apply", "--check", inverse], { cwd: directory });
    await exec("git", ["apply", inverse], { cwd: directory });
    expect(await readSources(directory)).toEqual(original);
    await expect(
      verifySourceTrialSnapshot(prepared, await readSources(directory), "before"),
    ).resolves.toBeUndefined();
    expect(await readFile(join(directory, "support-notes.txt"), "utf8")).toBe(unrelatedLaterWork);
  });

  it.each([
    ["before", "src/Booking.tsx"],
    ["before", "src/Booking.module.css"],
    ["after", "src/Booking.tsx"],
    ["after", "src/Booking.module.css"],
  ] as const)(
    "refuses a later edit in the %s snapshot (%s) before apply or rollback",
    async (phase, path) => {
      const baseline =
        phase === "before"
          ? original
          : prepared.files.map((file) => ({ path: file.path, content: file.after }));
      const changed = baseline.map((file) =>
        file.path === path
          ? { ...file, content: file.content + "\n/* Owner's later edit. */\n" }
          : file,
      );
      await expect(verifySourceTrialSnapshot(prepared, changed, phase)).rejects.toThrow();
      expect(changed.find((file) => file.path === path)!.content).toContain("Owner's later edit.");
    },
  );

  it("refuses partial application against both before and after snapshots", async () => {
    const partial = prepared.files.map((file, index) => ({
      path: file.path,
      content: index === 0 ? file.after : file.before,
    }));
    await expect(verifySourceTrialSnapshot(prepared, partial, "before")).rejects.toThrow();
    await expect(verifySourceTrialSnapshot(prepared, partial, "after")).rejects.toThrow();
  });
});

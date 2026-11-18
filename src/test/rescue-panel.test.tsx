import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RescuePanel } from "@/components/RescuePanel";
import { rescueSource } from "@/lib/rescue";
import { normalizeTokens, type Content } from "@/lib/design";
import { saveBaseline } from "@/lib/transfer";

const calls = vi.hoisted(() => ({
  paid: vi.fn(async () => {
    throw new Error("Paid AI requests are paused until launch approval.");
  }),
  navigate: vi.fn(async () => {}),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => calls.navigate }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => calls.paid }));
vi.mock("@/lib/design.functions", () => ({ proposeDirections: vi.fn() }));
vi.mock("@/lib/useDesignFonts", () => ({ useDesignFonts: vi.fn() }));
vi.mock("@/lib/projects", () => ({ STUDIO_KEY: "refraction:v1" }));
vi.mock("@/lib/transfer", () => ({ saveBaseline: vi.fn() }));
vi.mock("@/components/DesignPreview", () => ({
  PreviewFrame: ({ c }: { c: Content }) => (
    <section aria-label="Rescue preview">
      <h3>{c.headline}</h3>
      <p>{c.sub}</p>
      <p>{c.cta}</p>
    </section>
  ),
}));
const source = rescueSource(
  "<title>Original Studio</title><h1>Book our real class</h1><p>These are our original words.</p><h2>Actual service</h2><button>Book now</button>",
  "https://example.com/classes",
);
const inventory = {
  url: source.url,
  links: ["/classes"],
  forms: [],
  fields: [],
  buttons: ["button:Book now"],
};
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.mocked(saveBaseline).mockReturnValue(true);
});

describe("local existing-site rescue", () => {
  it("offers three curated directions while paid AI is paused and preserves extracted words", async () => {
    render(<RescuePanel source={source} inventory={inventory} />);
    fireEvent.click(screen.getByRole("button", { name: "Create three redesigns" }));
    const choices = await screen.findByRole("group", { name: "Redesign direction" });
    expect(choices.querySelectorAll("button")).toHaveLength(3);
    expect(calls.paid).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: source.content.headline })).toBeInTheDocument();
    expect(screen.getByText(source.content.sub)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open redesign Vision" }));
    await waitFor(() =>
      expect(calls.navigate).toHaveBeenCalledWith({ to: "/", search: { view: "studio" } }),
    );
    const pending = JSON.parse(sessionStorage.getItem("refraction:pending-rescue")!);
    expect(pending.content).toEqual(source.content);
    expect(pending.integration).toBe("existing");
    expect(pending.aiCalls).toBe(0);
  });

  it("keeps the old Studio and selection when the comparison baseline cannot be saved", async () => {
    const old = JSON.stringify({
      tokens: normalizeTokens({}),
      content: { headline: "Keep my work" },
    });
    localStorage.setItem("refraction:v1", old);
    vi.mocked(saveBaseline).mockReturnValue(false);
    render(<RescuePanel source={source} inventory={inventory} />);
    fireEvent.click(screen.getByRole("button", { name: "Create three redesigns" }));
    await screen.findByRole("group", { name: "Redesign direction" });
    fireEvent.click(screen.getByRole("button", { name: "Open redesign Vision" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Open redesign$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/comparison.*could not be saved/i);
    expect(calls.navigate).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("refraction:pending-rescue")).toBeNull();
    expect(localStorage.getItem("refraction:v1")).toBe(old);
    expect(
      screen.getByRole("group", { name: "Redesign direction" }).querySelectorAll("button"),
    ).toHaveLength(3);
    vi.mocked(saveBaseline).mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Open redesign Vision" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Open redesign$/ }));
    await waitFor(() => expect(calls.navigate).toHaveBeenCalledOnce());
  });
});

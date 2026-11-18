import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FIELD_GUIDE_CHOICES,
  FIELD_GUIDE_SOURCES,
  FIELD_GUIDE_TERMS,
  type FieldGuideChoice,
} from "@/lib/field-guide";
import { STUDIO_KEY } from "@/lib/projects";
import { LIBRARY_KEY } from "@/lib/library";
import { PROGRESS_KEY } from "@/lib/launch";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    search,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    to: string;
    search?: Record<string, string>;
  }) => (
    <a
      href={to + (search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : "")}
      {...props}
    />
  ),
}));
import { FieldGuide } from "@/components/FieldGuide";

function visit(station: FieldGuideChoice) {
  const index = FIELD_GUIDE_CHOICES.findIndex((choice) => choice.id === station.id);
  fireEvent.click(screen.getByRole("button", { name: `${index + 1}. ${station.title}` }));
}
function choose(station: FieldGuideChoice, optionIndex: 0 | 1) {
  fireEvent.click(screen.getByRole("radio", { name: station.options[optionIndex].label }));
}
function explored(count: number) {
  return screen.getByText(`${count} of ${FIELD_GUIDE_CHOICES.length} choices explored`);
}

beforeEach(() => {
  vi.stubEnv("VITE_FOCUS_HOSTED", "false");
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Field Guide practice", () => {
  it("keeps all practice, revision, search and depth changes local to the guide", () => {
    const records = [
      [STUDIO_KEY, "unfinished owner design"],
      [LIBRARY_KEY, "saved designs and versions"],
      [PROGRESS_KEY, "actual project evidence"],
      ["focus:garden:v1", "saved reading preferences"],
    ] as const;
    for (const [key, value] of records) localStorage.setItem(key, value);
    sessionStorage.setItem("existing-session-work", "keep this too");
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const removes = vi.spyOn(Storage.prototype, "removeItem");
    const clears = vi.spyOn(Storage.prototype, "clear");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const requests = vi.spyOn(XMLHttpRequest.prototype, "send");
    const view = render(<FieldGuide />);
    for (const station of FIELD_GUIDE_CHOICES) {
      visit(station);
      choose(station, 0);
      choose(station, 1);
    }
    expect(explored(FIELD_GUIDE_CHOICES.length)).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Keep it brief" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a term" }), {
      target: { value: "contrast" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset practice" }));
    choose(FIELD_GUIDE_CHOICES[0]!, 0);
    view.unmount();
    render(<FieldGuide />);
    expect(explored(0)).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Keep it brief" })).toBeChecked();
    expect(screen.getByRole("searchbox", { name: "Find a term" })).toHaveValue("");
    expect(writes).not.toHaveBeenCalled();
    expect(removes).not.toHaveBeenCalled();
    expect(clears).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(requests).not.toHaveBeenCalled();
    for (const [key, value] of records) expect(localStorage.getItem(key)).toBe(value);
    expect(sessionStorage.getItem("existing-session-work")).toBe("keep this too");
  });

  it.each(FIELD_GUIDE_CHOICES)("updates the actual consequences when revising $id", (station) => {
    render(<FieldGuide />);
    visit(station);
    expect(screen.queryByRole("region", { name: "What this choice changes" })).toBeNull();
    choose(station, 0);
    const first = station.options[0],
      revised = station.options[1];
    let consequences = screen.getByRole("region", { name: "What this choice changes" });
    expect(within(consequences).getByText(first.benefit)).toBeVisible();
    expect(within(consequences).getByText(first.tradeoff)).toBeVisible();
    for (const effect of first.downstream)
      expect(within(consequences).getByText(effect)).toBeVisible();
    choose(station, 1);
    consequences = screen.getByRole("region", { name: "What this choice changes" });
    expect(within(consequences).getByText(revised.benefit)).toBeVisible();
    expect(within(consequences).getByText(revised.tradeoff)).toBeVisible();
    for (const effect of revised.downstream)
      expect(within(consequences).getByText(effect)).toBeVisible();
    expect(within(consequences).queryByText(first.benefit)).toBeNull();
    expect(within(consequences).queryByText(first.tradeoff)).toBeNull();
    expect(screen.getByRole("radio", { name: revised.label })).toBeChecked();
    expect(screen.getByRole("radio", { name: first.label })).not.toBeChecked();
    expect(explored(1)).toBeVisible();
    if (revised.route) {
      const destination = within(consequences).getByRole("link");
      expect(destination).toHaveAttribute("href", revised.route);
      expect(destination).toHaveAccessibleName(/Target|studio|quality/i);
      expect(within(consequences).getByText(/practice choice is not applied/)).toBeVisible();
    }
  });

  it("preserves choices while navigating, focuses each station, and resets exploration without certifying a project", () => {
    render(<FieldGuide />);
    expect(screen.getByRole("button", { name: "Previous station" })).toBeDisabled();
    for (const [index, station] of FIELD_GUIDE_CHOICES.entries()) {
      expect(screen.getByRole("heading", { name: station.title })).toBeVisible();
      choose(station, 0);
      expect(explored(index + 1)).toBeVisible();
      if (index < FIELD_GUIDE_CHOICES.length - 1) {
        fireEvent.click(screen.getByRole("button", { name: "Next station" }));
        expect(
          screen.getByRole("heading", { name: FIELD_GUIDE_CHOICES[index + 1]!.title }),
        ).toHaveFocus();
      }
    }
    expect(screen.getByRole("button", { name: "Next station" })).toBeDisabled();
    expect(screen.getByText(/There are no right answers or scores/)).toBeVisible();
    expect(screen.getByText(/these choices do not change your project/)).toBeVisible();
    expect(
      screen.queryByText(/^(All tests passed|Your project is ready to launch|Launch ready)$/i),
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Previous station" }));
    const previous = FIELD_GUIDE_CHOICES.at(-2)!;
    expect(screen.getByRole("heading", { name: previous.title })).toHaveFocus();
    expect(screen.getByRole("radio", { name: previous.options[0].label })).toBeChecked();
    visit(FIELD_GUIDE_CHOICES[0]!);
    expect(screen.getByRole("heading", { name: FIELD_GUIDE_CHOICES[0]!.title })).toHaveFocus();
    expect(
      screen.getByRole("radio", { name: FIELD_GUIDE_CHOICES[0]!.options[0].label }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Reset practice" }));
    expect(explored(0)).toBeVisible();
    expect(screen.getByRole("heading", { name: FIELD_GUIDE_CHOICES[0]!.title })).toHaveFocus();
    for (const station of FIELD_GUIDE_CHOICES) {
      visit(station);
      expect(
        screen.getAllByRole("radio").every((radio) => !(radio as HTMLInputElement).checked),
      ).toBe(true);
      expect(screen.queryByRole("region", { name: "What this choice changes" })).toBeNull();
    }
    fireEvent.click(screen.getByRole("button", { name: "Reset practice" }));
    expect(screen.getByRole("heading", { name: FIELD_GUIDE_CHOICES[0]!.title })).toHaveFocus();
  });

  it("opens and folds deeper explanations reliably while keeping definitions and practice outcomes visible", () => {
    render(<FieldGuide />);
    const first = FIELD_GUIDE_TERMS[0]!;
    const article = screen.getByRole("article", { name: first.term });
    const summary = within(article)
      .getByText(/Example and why it matters/)
      .closest("summary")!;
    expect(within(article).getByText(first.plain)).toBeVisible();
    expect(within(article).getByText(first.example)).not.toBeVisible();
    fireEvent.click(summary);
    expect(within(article).getByText(first.example)).toBeVisible();
    choose(FIELD_GUIDE_CHOICES[0]!, 0);
    const outcome = FIELD_GUIDE_CHOICES[0]!.options[0].tradeoff;
    fireEvent.click(screen.getByRole("checkbox", { name: "Keep it brief" }));
    for (const term of FIELD_GUIDE_TERMS) {
      const entry = screen.getByRole("article", { name: term.term });
      expect(within(entry).getByText(term.example)).toBeVisible();
      expect(within(entry).getByText(term.whyItMatters)).toBeVisible();
    }
    expect(screen.getByText(outcome)).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Keep it brief" }));
    for (const term of FIELD_GUIDE_TERMS) {
      const entry = screen.getByRole("article", { name: term.term });
      expect(within(entry).getByText(term.example)).not.toBeVisible();
      expect(within(entry).getByText(term.plain)).toBeVisible();
    }
    expect(screen.getByText(outcome)).toBeVisible();
  });

  it("finds terms case-insensitively and recovers from an empty result without losing practice choices", () => {
    render(<FieldGuide />);
    choose(FIELD_GUIDE_CHOICES[0]!, 1);
    const search = screen.getByRole("searchbox", { name: "Find a term" });
    const term = FIELD_GUIDE_TERMS.find((entry) => entry.id === "contrast")!;
    fireEvent.change(search, { target: { value: `  ${term.term.toUpperCase()}  ` } });
    expect(screen.getByRole("article", { name: term.term })).toBeVisible();
    expect(screen.queryByRole("article", { name: FIELD_GUIDE_TERMS[0]!.term })).toBeNull();
    fireEvent.change(search, { target: { value: "zzzz-no-matching-guide-term" } });
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getByText(/No terms match this search/)).toBeVisible();
    expect(explored(1)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");
    expect(screen.getAllByRole("article")).toHaveLength(FIELD_GUIDE_TERMS.length);
    expect(
      screen.getByRole("radio", { name: FIELD_GUIDE_CHOICES[0]!.options[1].label }),
    ).toBeChecked();
  });

  it("connects definitions to real references and offers useful return links", () => {
    render(<FieldGuide />);
    for (const term of FIELD_GUIDE_TERMS) {
      const article = screen.getByRole("article", { name: term.term });
      expect(term.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of term.sourceIds) {
        const source = FIELD_GUIDE_SOURCES.find((item) => item.id === sourceId);
        expect(source, `Missing reference for ${term.term}`).toBeDefined();
        const anchor = within(article)
          .getAllByRole("link")
          .find((link) => link.getAttribute("href") === `#source-${sourceId}`);
        expect(anchor).toBeDefined();
        expect(document.getElementById(`source-${sourceId}`)).toBeInTheDocument();
      }
    }
    const sources = screen.getByRole("region", { name: "Where these explanations come from" });
    for (const source of FIELD_GUIDE_SOURCES) {
      const link = within(sources).getByRole("link", {
        name: (name) => name.startsWith(source.title),
      });
      expect(link).toHaveAttribute("href", source.url);
      expect(new URL(source.url).protocol).toBe("https:");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")?.split(/\s+/)).toContain("noopener");
      expect(link).toHaveAccessibleName(/opens in a new tab/);
    }
    for (const station of FIELD_GUIDE_CHOICES)
      for (const id of station.termIds)
        expect(FIELD_GUIDE_TERMS.some((term) => term.id === id)).toBe(true);
    expect(screen.getByRole("link", { name: "Back to the Garden Path" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Open the design studio" })).toHaveAttribute(
      "href",
      "/?view=studio",
    );
  });

  it("uses labelled native practice and learning controls with an identifiable main region", () => {
    render(<FieldGuide />);
    const first = FIELD_GUIDE_CHOICES[0]!;
    const group = screen.getByRole("group", { name: first.question });
    expect(group.tagName).toBe("FIELDSET");
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]!.getAttribute("name")).toBe(radios[1]!.getAttribute("name"));
    for (const radio of radios) expect(radio).toHaveAccessibleName();
    const brief = screen.getByRole("checkbox", { name: "Keep it brief" });
    expect(brief).toHaveAccessibleDescription(/open the examples/);
    expect(screen.getByRole("searchbox", { name: "Find a term" })).toHaveAccessibleDescription(
      /terms shown/,
    );
    for (const button of screen.getAllByRole("button"))
      expect(button).toHaveAttribute("type", "button");
    expect(screen.getByRole("heading", { name: first.title })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });
});

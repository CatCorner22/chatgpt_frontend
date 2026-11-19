import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppPreview } from "@/components/AppPreview";
import { PreviewFrame } from "@/components/DesignPreview";
import { normalizeTokens } from "@/lib/design";
import { signalText, type AppScreen } from "@/lib/appDesign";

const content = {
  brand: "Owner studio",
  headline: "A real offer",
  sub: "Owner details",
  cta: "Visit the owner",
  features: [],
  quote: "",
};
const tokens = normalizeTokens({});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function frame() {
  render(<PreviewFrame t={tokens} c={content} experience="app" />);
  const pages = screen.getByRole("group", { name: "Page type" });
  return (name: string) =>
    fireEvent.click(within(pages).getByRole("button", { name, exact: true }));
}

function submitSampleSignIn() {
  fireEvent.change(screen.getByLabelText("Email", { exact: true }), {
    target: { value: "sample@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "made-up-password" } });
  fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "Sign in" }));
}

describe("local app preview", () => {
  it.each(["solid", "outline", "pill", "underline"] as const)(
    "shows the selected %s treatment across primary actions and corner limits",
    (buttonStyle) => {
      const cases: [AppScreen, string][] = [
        ["settings", "Save changes"],
        ["sign-in", "Sign in"],
        ["empty", "Create first record"],
        ["error", "Try again"],
      ];
      const { rerender } = render(
        <AppPreview t={tokens} c={content} phone={false} screen="settings" />,
      );
      for (const radius of [0, 28]) {
        const selected = normalizeTokens({ ...tokens, buttonStyle, radius });
        for (const [page, action] of cases) {
          rerender(<AppPreview t={selected} c={content} phone={false} screen={page} />);
          const button = screen.getByRole("button", { name: action });
          const filled = buttonStyle === "solid" || buttonStyle === "pill";
          expect(button).toHaveStyle({
            background: filled ? selected.accent : "transparent",
            color: filled ? selected.accentInk : signalText(selected),
            borderRadius:
              buttonStyle === "pill"
                ? "999px"
                : buttonStyle === "underline" || radius === 0
                  ? "0"
                  : `${radius}px`,
            minHeight: "44px",
            minWidth: "44px",
          });
          if (buttonStyle === "outline")
            expect(button).toHaveStyle({ border: `2px solid ${selected.accent}` });
          if (buttonStyle === "underline")
            expect(button).toHaveStyle({
              borderTopWidth: "0px",
              borderBottom: `2px solid ${selected.accent}`,
            });
        }
      }
    },
  );

  it("keeps the chosen corner radius on sample fields and panels", () => {
    const selected = normalizeTokens({ radius: 28 });
    const { rerender } = render(
      <AppPreview t={selected} c={content} phone={false} screen="settings" />,
    );
    expect(screen.getByRole("textbox", { name: "Workspace name" })).toHaveStyle({
      borderRadius: "28px",
    });
    rerender(<AppPreview t={selected} c={content} phone={false} screen="dashboard" />);
    expect(screen.getByText("Completed").parentElement).toHaveStyle({ borderRadius: "28px" });
  });

  it("does not turn a settings save into a successful sign-in", () => {
    const choose = frame();
    choose("Settings");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved in this preview");
    choose("Sign in");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email", { exact: true })).toHaveValue("");
  });

  it("does not turn a sample sign-in into saved settings", () => {
    const choose = frame();
    choose("Sign in");
    submitSampleSignIn();
    expect(screen.getByRole("status")).toHaveTextContent("Sample sign-in complete");
    choose("Settings");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("clears sample sign-in feedback when edited or when reopening the empty form", () => {
    const choose = frame();
    choose("Sign in");
    submitSampleSignIn();
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "another-made-up-password" },
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    submitSampleSignIn();
    expect(screen.getByRole("status")).toHaveTextContent("Sample sign-in complete");
    choose("Dashboard");
    choose("Sign in");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("keeps the practice forms local and explains sign-in before any input", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const write = vi.spyOn(Storage.prototype, "setItem");
    const choose = frame();
    choose("Sign in");
    expect(screen.getByText(/Use made-up details/)).toBeInTheDocument();
    submitSampleSignIn();
    choose("Settings");
    fireEvent.change(screen.getByRole("textbox", { name: "Workspace name" }), {
      target: { value: "Practice workspace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved in this preview");
    fireEvent.change(screen.getByRole("textbox", { name: "Workspace name" }), {
      target: { value: "Edited workspace" },
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("preserves retry and create behavior after changing the action treatment", () => {
    const selected = normalizeTokens({ buttonStyle: "underline", radius: 28 });
    const { rerender } = render(
      <AppPreview t={selected} c={content} phone={true} screen="error" />,
    );
    const retry = screen.getByRole("button", { name: "Try again" });
    fireEvent.click(retry);
    expect(screen.getByRole("status")).toHaveTextContent("Activity restored");
    expect(retry).toBeDisabled();
    rerender(<AppPreview t={selected} c={content} phone={true} screen="empty" />);
    const create = screen.getByRole("button", { name: "Create first record" });
    fireEvent.click(create);
    expect(screen.getByRole("heading", { name: "First record created" })).toBeInTheDocument();
    expect(create).toBeDisabled();
  });

  it("keeps an unfinished settings exercise when the design changes, and clears success for any edit", () => {
    const { rerender } = render(
      <AppPreview t={tokens} c={content} phone={false} screen="settings" />,
    );
    const name = screen.getByRole("textbox", { name: "Workspace name" });
    fireEvent.change(name, { target: { value: "Unfinished practice" } });
    rerender(
      <AppPreview
        t={normalizeTokens({ ...tokens, buttonStyle: "pill", radius: 28 })}
        c={content}
        phone={false}
        screen="settings"
      />,
    );
    expect(name).toHaveValue("Unfinished practice");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("status")).toHaveTextContent("Saved in this preview");
    fireEvent.click(screen.getByRole("checkbox", { name: "Email updates" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("does not confirm empty settings or an invalid sample email", () => {
    const choose = frame();
    choose("Settings");
    fireEvent.change(screen.getByRole("textbox", { name: "Workspace name" }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    choose("Sign in");
    fireEvent.change(screen.getByLabelText("Email", { exact: true }), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "made-up-password" },
    });
    fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "Sign in" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email", { exact: true })).toHaveValue("not-an-email");
  });
});

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InteractionLab } from "@/components/InteractionLab";
import { contrast, normalizeTokens, type Tokens } from "@/lib/design";

const tokens = normalizeTokens({});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("InteractionLab", () => {
  it("labels the exercise's limits and uses real focusable buttons with local feedback", () => {
    render(<InteractionLab tokens={tokens} />);
    expect(screen.getByText("Local component exercise")).toBeInTheDocument();
    expect(
      screen.getByText(/does not test your customer app or add components to your exports/),
    ).toBeInTheDocument();
    const primary = screen.getByRole("button", { name: "Try primary button" });
    const reset = screen.getByRole("button", { name: "Reset button count" });
    const disabled = screen.getByRole("button", { name: "Unavailable action" });
    act(() => primary.focus());
    expect(primary).toHaveFocus();
    fireEvent.click(primary);
    expect(
      screen.getByText("Primary button activated 1 time in this exercise."),
    ).toBeInTheDocument();
    expect(disabled).toBeDisabled();
    fireEvent.click(disabled);
    expect(
      screen.getByText("Primary button activated 1 time in this exercise."),
    ).toBeInTheDocument();
    act(() => reset.focus());
    expect(reset).toHaveFocus();
    fireEvent.click(reset);
    expect(screen.getByText("No demo button activations yet.")).toBeInTheDocument();
    for (const button of [primary, reset, disabled])
      expect(button).toHaveStyle({ minHeight: "44px", minWidth: "44px" });
  });

  it("uses native email validity with associated inline errors and preserves invalid input", () => {
    render(<InteractionLab tokens={tokens} />);
    const input = screen.getByRole("textbox", { name: "Demo email address (required)" });
    const form = screen.getByRole("form", { name: "Form feedback" });
    expect(input).toHaveAttribute("type", "email");
    expect(input).toBeRequired();
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toHaveTextContent("Enter an email address to try the demo.");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")?.split(" ")).toContain(
      screen.getByRole("alert").id,
    );
    fireEvent.change(input, { target: { value: "not-an-email" } });
    fireEvent.submit(form);
    expect(input).toHaveValue("not-an-email");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter an email address like name@example.com.",
    );
    expect(screen.queryByText(/Demo only; nothing was sent/)).not.toBeInTheDocument();
  });

  it("confirms only a local valid-format demo and never sends or persists the address", () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const write = vi.spyOn(Storage.prototype, "setItem");
    render(<InteractionLab tokens={tokens} />);
    const input = screen.getByRole("textbox", { name: "Demo email address (required)" });
    fireEvent.change(input, { target: { value: "sample@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Try demo form" }));
    expect(
      screen.getByText("Demo only; nothing was sent. The sample address has a valid email format."),
    ).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "different@example.com" } });
    expect(screen.queryByText(/Demo only; nothing was sent/)).not.toBeInTheDocument();
  });

  it("opens optional help on keyboard focus and closes it with Escape", async () => {
    render(<InteractionLab tokens={tokens} />);
    const trigger = screen.getByRole("button", { name: "Show optional tip" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => trigger.focus());
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent(
      "A useful tooltip adds a short explanation without hiding an essential instruction.",
    );
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
    fireEvent.keyDown(trigger, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("also opens optional help on pointer hover", async () => {
    render(<InteractionLab tokens={tokens} />);
    fireEvent.pointerMove(screen.getByRole("button", { name: "Show optional tip" }), {
      pointerType: "mouse",
    });
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
  });

  it("lets the user inspect deterministic loading, error, and empty examples", () => {
    render(<InteractionLab tokens={tokens} />);
    fireEvent.click(screen.getByText("Explore loading, error, and empty states"));
    const group = screen.getByRole("group", { name: "Choose an example state" });
    expect(within(group).getByRole("radio", { name: "Empty" })).toBeChecked();
    fireEvent.click(within(group).getByRole("radio", { name: "Loading" }));
    expect(screen.getByText(/Loading example:.*No request is running/)).toBeInTheDocument();
    fireEvent.click(within(group).getByRole("radio", { name: "Error" }));
    expect(screen.getByText(/Error example:.*No real request failed/)).toBeInTheDocument();
    fireEvent.click(within(group).getByRole("radio", { name: "Empty" }));
    expect(screen.getByText(/Empty example: no sample items yet/)).toBeInTheDocument();
  });

  it.each(["solid", "pill", "outline", "underline"] as const)(
    "updates %s buttons from tokens while preserving readable labels and target sizes",
    (buttonStyle) => {
      const revised: Tokens = normalizeTokens({
        bg: "#ffffff",
        surface: "#ffffff",
        ink: "#eeeeee",
        muted: "#eeeeee",
        accent: "#ffff00",
        accentInk: "#ffffee",
        radius: 17,
        buttonStyle,
      });
      const { rerender } = render(<InteractionLab tokens={tokens} />);
      rerender(<InteractionLab tokens={revised} />);
      expect(
        screen.getByText(/This exercise adjusts some text colors for readability/),
      ).toHaveTextContent(/does not change your saved design/);
      const primary = screen.getByRole("button", { name: "Try primary button" });
      expect(primary).toHaveStyle({
        minHeight: "44px",
        borderRadius: buttonStyle === "pill" ? "999px" : "17px",
        color: "#000000",
      });
      if (buttonStyle === "solid" || buttonStyle === "pill") {
        expect(primary).toHaveStyle({ background: revised.accent });
        expect(contrast("#000000", revised.accent)).toBeGreaterThanOrEqual(4.5);
      } else {
        expect(primary).toHaveStyle({ background: "transparent" });
        expect(contrast("#000000", revised.bg)).toBeGreaterThanOrEqual(4.5);
      }
      if (buttonStyle === "underline") expect(primary).toHaveStyle({ textDecoration: "underline" });
      if (buttonStyle === "outline") expect(primary).toHaveStyle({ border: "2px solid #000000" });
      expect(screen.getByRole("textbox", { name: "Demo email address (required)" })).toHaveStyle({
        border: "2px solid #000000",
      });
    },
  );
});

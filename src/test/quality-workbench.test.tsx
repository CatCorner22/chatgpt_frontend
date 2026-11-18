import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { QualityWorkbench } from "@/components/QualityWorkbench";

vi.mock("@/components/AppHeader", () => ({ AppHeader: () => <header>Focus</header> }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, className }: { to: string; children: ReactNode; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));
afterEach(cleanup);

describe("quality workbench evidence", () => {
  it("finds static sample defects without pretending layout checks ran", () => {
    render(<QualityWorkbench />);
    fireEvent.click(screen.getByRole("button", { name: "Flawed sample" }));
    expect(screen.getByRole("heading", { name: "3 findings to work through." })).toBeTruthy();
    expect(screen.getByText("Native autoplay attribute present")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Not measured 7/ })).toBeTruthy();
    expect(screen.queryByText(/1600px content/)).toBeNull();
  });
  it("identifies stale results and clears the editor and receipt together", () => {
    render(<QualityWorkbench />);
    fireEvent.click(screen.getByRole("button", { name: "Reference sample" }));
    expect(
      screen.getByRole("heading", { name: "No defects found by these static checks." }),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Page HTML"), {
      target: { value: "<p>A new page</p>" },
    });
    expect(
      screen.getByText("The HTML changed. These results describe the previous version."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect((screen.getByLabelText("Page HTML") as HTMLTextAreaElement).value).toBe("");
    expect(screen.queryByText("Your inspection receipt")).toBeNull();
  });
});

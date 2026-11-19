import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/garden-decisions.data.json", () => {
  throw new Error("Simulated optional chunk failure");
});
import { GardenDecisionGuide } from "@/components/GardenDecisionGuide";

afterEach(cleanup);

it("contains an optional guide failure and keeps a retry action available", async () => {
  const view = render(<GardenDecisionGuide stepId="goal" />);
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/could not load/));
  expect(screen.getByRole("status")).toHaveTextContent(/rest of the path are still available/);
  fireEvent.click(screen.getByRole("button", { name: "Load the field notes again" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/could not load/));
  view.unmount();
});

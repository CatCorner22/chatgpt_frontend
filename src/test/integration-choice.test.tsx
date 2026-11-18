import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { IntegrationChoice } from "@/components/IntegrationChoice";
import type { Integration } from "@/lib/design";

describe("deliverable intent choice", () => {
  it("offers an existing-project path without editing the owner's words", () => {
    function Trial() {
      const [mode, setMode] = useState<Integration>("new");
      return (
        <>
          <IntegrationChoice value={mode} onChange={setMode} />
          <textarea
            aria-label="Owner brief"
            defaultValue="Redesign this checkout without changing behavior"
          />
        </>
      );
    }
    render(<Trial />);
    fireEvent.click(screen.getByRole("radio", { name: /Restyle my existing/ }));
    expect(screen.getByRole("radio", { name: /Restyle my existing/ })).toBeChecked();
    expect(screen.getByText(/Keep your working pages/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /A new site/ }));
    expect(screen.getByRole("radio", { name: /A new site/ })).toBeChecked();
    expect(screen.getByLabelText("Owner brief")).toHaveValue(
      "Redesign this checkout without changing behavior",
    );
  });
});

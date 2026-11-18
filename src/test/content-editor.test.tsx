import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContentEditor } from "@/components/ContentEditor";
import type { Content } from "@/lib/design";

const initial: Content = {
  brand: "Sample studio",
  headline: "A useful service",
  sub: "Describe it clearly.",
  cta: "Get in touch",
  features: [{ title: "Consultation", body: "Discuss your project." }],
  quote: "A starter quote",
};
function Editor({ content = initial }: { content?: Content }) {
  const [value, setValue] = useState(content);
  return (
    <>
      <ContentEditor content={value} onChange={setValue} />
      <output data-testid="content">{JSON.stringify(value)}</output>
    </>
  );
}

describe("owner content editor", () => {
  it("edits real copy, adds an empty offer, and removes sample proof without losing other fields", () => {
    render(<Editor />);
    fireEvent.click(screen.getByText("Make the words yours"));
    fireEvent.change(screen.getByLabelText("Business or project name"), {
      target: { value: "Maple Studio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add a feature" }));
    fireEvent.change(screen.getByLabelText("Feature 2"), { target: { value: "Site visits" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove quote" }));
    const value = JSON.parse(screen.getByTestId("content").textContent!);
    expect(value).toEqual({
      ...initial,
      brand: "Maple Studio",
      features: [...initial.features, { title: "Site visits", body: "" }],
      quote: "",
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove feature 1" }));
    expect(screen.getByLabelText("Feature 1")).toHaveValue("Site visits");
  });

  it("limits the list to eight offers", () => {
    render(
      <Editor
        content={{
          ...initial,
          features: Array.from({ length: 8 }, () => ({ title: "", body: "" })),
        }}
      />,
    );
    fireEvent.click(screen.getByText("Make the words yours"));
    expect(screen.getByRole("button", { name: "Add a feature" })).toBeDisabled();
  });
});

import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

function OpenEditor({ content = initial }: { content?: Content }) {
  const [value, setValue] = useState(content);
  return <ContentEditor content={value} onChange={setValue} defaultOpen />;
}

function activate(button: HTMLElement) {
  // Model an already focused control being activated. This tests DOM focus,
  // not browser-specific keyboard event synthesis or Tab order.
  button.focus();
  fireEvent.click(button);
}

const offers = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    title: `Offer ${index + 1}`,
    body: `Description ${index + 1}`,
  }));

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

describe("content editor focus after owner acceptance", () => {
  it.each([1, 7])("focuses the newly accepted feature title after adding to %i offers", (count) => {
    render(<OpenEditor content={{ ...initial, features: offers(count) }} />);
    activate(screen.getByRole("button", { name: "Add a feature" }));
    expect(screen.getByLabelText(`Feature ${count + 1}`)).toHaveFocus();
    expect(screen.getByLabelText(`Feature ${count + 1}`)).toHaveValue("");
    expect(screen.getByLabelText("Feature 1")).toHaveValue("Offer 1");
    if (count === 7) expect(screen.getByRole("button", { name: "Add a feature" })).toBeDisabled();
  });

  it.each([
    { count: 3, remove: 1, target: "Feature 1", value: "Offer 2" },
    { count: 3, remove: 2, target: "Feature 2", value: "Offer 3" },
    { count: 3, remove: 3, target: "Feature 2", value: "Offer 2" },
    { count: 1, remove: 1, target: "Add a feature", value: null },
  ])("moves focus after removing offer $remove of $count", ({ count, remove, target, value }) => {
    render(<OpenEditor content={{ ...initial, features: offers(count) }} />);
    activate(screen.getByRole("button", { name: `Remove feature ${remove}` }));
    const destination =
      value === null ? screen.getByRole("button", { name: target }) : screen.getByLabelText(target);
    expect(destination).toHaveFocus();
    if (value !== null) expect(destination).toHaveValue(value);
    expect(screen.queryByLabelText(`Feature ${count}`)).not.toBeInTheDocument();
  });

  it("returns to the quote textarea after its removal button disappears", () => {
    render(<OpenEditor />);
    activate(screen.getByRole("button", { name: "Remove quote" }));
    expect(screen.getByLabelText(/Real customer quote/)).toHaveFocus();
    expect(screen.getByLabelText(/Real customer quote/)).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Remove quote" })).not.toBeInTheDocument();
  });

  it("waits for an accepted delayed update, including a cloned parent value", () => {
    const onChange = vi.fn();
    const view = render(<ContentEditor content={initial} onChange={onChange} defaultOpen />);
    const add = screen.getByRole("button", { name: "Add a feature" });
    activate(add);
    expect(add).toHaveFocus();
    expect(screen.queryByLabelText("Feature 2")).not.toBeInTheDocument();
    view.rerender(
      <ContentEditor
        content={JSON.parse(JSON.stringify(onChange.mock.calls[0]![0]))}
        onChange={onChange}
        defaultOpen
      />,
    );
    expect(screen.getByLabelText("Feature 2")).toHaveFocus();
  });

  it("abandons a rejected update before a later matching external change", () => {
    const onChange = vi.fn();
    const view = render(<ContentEditor content={initial} onChange={onChange} defaultOpen />);
    const add = screen.getByRole("button", { name: "Add a feature" });
    activate(add);
    const requested = onChange.mock.calls[0]![0] as Content;
    view.rerender(<ContentEditor content={{ ...initial }} onChange={onChange} defaultOpen />);
    expect(add).toHaveFocus();
    view.rerender(<ContentEditor content={requested} onChange={onChange} defaultOpen />);
    expect(add).toHaveFocus();
  });

  it("abandons a pending focus request after any differing owner update", () => {
    const onChange = vi.fn();
    const view = render(<ContentEditor content={initial} onChange={onChange} defaultOpen />);
    const add = screen.getByRole("button", { name: "Add a feature" });
    activate(add);
    const requested = onChange.mock.calls[0]![0] as Content;
    view.rerender(
      <ContentEditor
        content={{ ...initial, headline: "A different owner edit" }}
        onChange={onChange}
        defaultOpen
      />,
    );
    view.rerender(<ContentEditor content={requested} onChange={onChange} defaultOpen />);
    expect(add).toHaveFocus();
  });

  it("does not move focus on ordinary typing or external updates without an edit request", () => {
    const onChange = vi.fn();
    const view = render(<ContentEditor content={initial} onChange={onChange} defaultOpen />);
    const headline = screen.getByLabelText("Headline");
    headline.focus();
    fireEvent.change(headline, { target: { value: "Owner headline" } });
    view.rerender(
      <ContentEditor content={onChange.mock.calls[0]![0]} onChange={onChange} defaultOpen />,
    );
    expect(headline).toHaveFocus();
    view.rerender(
      <ContentEditor
        content={{ ...initial, features: offers(2), quote: "" }}
        onChange={onChange}
        defaultOpen
      />,
    );
    expect(headline).toHaveFocus();
  });

  it("cancels delayed focus when the owner moves to another editor, even if they return", () => {
    const onChange = vi.fn();
    const pair = (content: Content) => (
      <>
        <section aria-label="First editor">
          <ContentEditor content={content} onChange={onChange} defaultOpen />
        </section>
        <section aria-label="Second editor">
          <ContentEditor content={initial} onChange={() => {}} defaultOpen />
        </section>
      </>
    );
    const view = render(pair(initial));
    const first = within(screen.getByRole("region", { name: "First editor" }));
    const second = within(screen.getByRole("region", { name: "Second editor" }));
    const add = first.getByRole("button", { name: "Add a feature" });
    activate(add);
    const otherTitle = second.getByLabelText("Feature 1");
    otherTitle.focus();
    add.focus();
    view.rerender(pair(onChange.mock.calls[0]![0]));
    expect(add).toHaveFocus();
    expect(first.getByLabelText("Feature 2")).not.toHaveFocus();
    expect(first.getByLabelText("Feature 1").id).not.toBe(otherTitle.id);
    expect(second.queryByLabelText("Feature 2")).not.toBeInTheDocument();
  });

  it("cancels pending focus when a later key or pointer intent occurs without a focus change", () => {
    const onChange = vi.fn();
    const view = render(<ContentEditor content={initial} onChange={onChange} defaultOpen />);
    const add = screen.getByRole("button", { name: "Add a feature" });
    activate(add);
    const requested = onChange.mock.calls[0]![0] as Content;
    fireEvent.keyDown(add, { key: "Tab" });
    view.rerender(<ContentEditor content={requested} onChange={onChange} defaultOpen />);
    expect(add).toHaveFocus();
    activate(add);
    fireEvent.pointerDown(document.body);
    view.rerender(
      <ContentEditor content={onChange.mock.calls[1]![0]} onChange={onChange} defaultOpen />,
    );
    expect(add).toHaveFocus();
  });

  it("keeps a delayed edit from focusing inside a closed editor", () => {
    const onChange = vi.fn();
    const view = render(<ContentEditor content={initial} onChange={onChange} defaultOpen />);
    const add = screen.getByRole("button", { name: "Add a feature" });
    activate(add);
    const details = add.closest("details")!;
    details.open = false;
    fireEvent(details, new Event("toggle"));
    view.rerender(
      <ContentEditor content={onChange.mock.calls[0]![0]} onChange={onChange} defaultOpen />,
    );
    expect(screen.getByLabelText("Feature 2")).not.toHaveFocus();
  });

  it("cancels a pending request when an ordinary field edit supersedes it", () => {
    const onChange = vi.fn();
    const view = render(<ContentEditor content={initial} onChange={onChange} defaultOpen />);
    const add = screen.getByRole("button", { name: "Add a feature" });
    activate(add);
    const requested = onChange.mock.calls[0]![0] as Content;
    // Exercise the edit guard without depending on a separate focus event.
    fireEvent.change(screen.getByLabelText("Headline"), {
      target: { value: "A newer edit" },
    });
    view.rerender(<ContentEditor content={requested} onChange={onChange} defaultOpen />);
    expect(add).toHaveFocus();
  });

  it("discards newer pending focus too when an older request arrives out of order", () => {
    const onChange = vi.fn();
    const view = render(<ContentEditor content={initial} onChange={onChange} defaultOpen />);
    activate(screen.getByRole("button", { name: "Add a feature" }));
    const olderRequest = onChange.mock.calls[0]![0] as Content;
    activate(screen.getByRole("button", { name: "Remove quote" }));
    const newerRequest = onChange.mock.calls[1]![0] as Content;
    view.rerender(<ContentEditor content={olderRequest} onChange={onChange} defaultOpen />);
    expect(screen.getByRole("button", { name: "Remove quote" })).toHaveFocus();
    view.rerender(<ContentEditor content={newerRequest} onChange={onChange} defaultOpen />);
    expect(screen.getByLabelText(/Real customer quote/)).not.toHaveFocus();
  });

  it("focuses only the activated editor and does not carry a request across unmount", () => {
    const view = render(
      <>
        <section aria-label="First editor">
          <OpenEditor />
        </section>
        <section aria-label="Second editor">
          <OpenEditor />
        </section>
      </>,
    );
    const first = within(screen.getByRole("region", { name: "First editor" }));
    const second = within(screen.getByRole("region", { name: "Second editor" }));
    activate(second.getByRole("button", { name: "Add a feature" }));
    expect(second.getByLabelText("Feature 2")).toHaveFocus();
    expect(first.queryByLabelText("Feature 2")).not.toBeInTheDocument();
    view.unmount();

    const onChange = vi.fn();
    const delayed = render(<ContentEditor content={initial} onChange={onChange} defaultOpen />);
    activate(screen.getByRole("button", { name: "Add a feature" }));
    const request = onChange.mock.calls[0]![0] as Content;
    delayed.unmount();
    render(<ContentEditor content={request} onChange={onChange} defaultOpen />);
    expect(screen.getByLabelText("Feature 2")).not.toHaveFocus();
  });
});

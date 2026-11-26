import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImageFramingControls } from "@/components/ImageFramingControls";
import type { ImageFraming } from "@/lib/image-framing";

function Controlled({ initial }: { initial?: ImageFraming }) {
  const [value, setValue] = useState(initial);
  return <ImageFramingControls value={value} onChange={setValue} />;
}

describe("Image framing controls", () => {
  it("defaults to a centered fill and keeps small-screen options optional", () => {
    const onChange = vi.fn();
    render(<ImageFramingControls onChange={onChange} />);
    expect(screen.getByRole("radio", { name: "Fill the frame" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Show the whole image" })).not.toBeChecked();
    expect(screen.getByRole("combobox", { name: "Image position" })).toHaveValue("center");
    expect(
      screen.getByRole("checkbox", { name: "Use a different position on small screens" }),
    ).not.toBeChecked();
    expect(screen.queryByRole("combobox", { name: "Small-screen image position" })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("lets wide and small-screen positioning change independently, then inherit again", () => {
    render(<Controlled />);
    fireEvent.change(screen.getByRole("combobox", { name: "Image position" }), {
      target: { value: "top-right" },
    });
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Use a different position on small screens" }),
    );
    expect(screen.getByRole("combobox", { name: "Small-screen image position" })).toHaveValue(
      "top-right",
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Small-screen image position" }), {
      target: { value: "bottom-left" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Image position" }), {
      target: { value: "right" },
    });
    expect(screen.getByRole("combobox", { name: "Small-screen image position" })).toHaveValue(
      "bottom-left",
    );
    expect(screen.getByRole("combobox", { name: "Image position" })).toHaveValue("right");
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Use a different position on small screens" }),
    );
    expect(screen.queryByRole("combobox", { name: "Small-screen image position" })).toBeNull();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Use a different position on small screens" }),
    );
    expect(screen.getByRole("combobox", { name: "Small-screen image position" })).toHaveValue(
      "right",
    );
  });

  it("keeps the chosen positions when showing the whole image and switching back", () => {
    render(<Controlled initial={{ fit: "cover", position: "left", narrowPosition: "top" }} />);
    fireEvent.click(screen.getByRole("radio", { name: "Show the whole image" }));
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Fill the frame" }));
    expect(screen.getByRole("combobox", { name: "Image position" })).toHaveValue("left");
    expect(screen.getByRole("combobox", { name: "Small-screen image position" })).toHaveValue(
      "top",
    );
  });

  it("resets whole-image mode and both positions to a centered fill", () => {
    render(
      <Controlled initial={{ fit: "contain", position: "bottom-right", narrowPosition: "left" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset image framing" }));
    expect(screen.getByRole("radio", { name: "Fill the frame" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Image position" })).toHaveValue("center");
    expect(
      screen.getByRole("checkbox", { name: "Use a different position on small screens" }),
    ).not.toBeChecked();
    expect(screen.queryByRole("combobox", { name: "Small-screen image position" })).toBeNull();
  });

  it("emits a new value without changing controlled values until the parent accepts it", () => {
    const initial: ImageFraming = { fit: "cover", position: "left", narrowPosition: "top" };
    const onChange = vi.fn();
    const view = render(<ImageFramingControls value={initial} onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Image position" }), {
      target: { value: "bottom" },
    });
    expect(onChange).toHaveBeenCalledWith({
      fit: "cover",
      position: "bottom",
      narrowPosition: "top",
    });
    expect(screen.getByRole("combobox", { name: "Image position" })).toHaveValue("left");
    expect(initial.position).toBe("left");
    view.rerender(
      <ImageFramingControls value={{ ...initial, position: "bottom" }} onChange={onChange} />,
    );
    expect(screen.getByRole("combobox", { name: "Image position" })).toHaveValue("bottom");
  });

  it("disables every editing control and rejects changes while unavailable", () => {
    const onChange = vi.fn();
    render(
      <ImageFramingControls
        disabled
        value={{ fit: "cover", position: "center", narrowPosition: "left" }}
        onChange={onChange}
      />,
    );
    for (const control of [
      ...screen.getAllByRole("radio"),
      ...screen.getAllByRole("combobox"),
      screen.getByRole("checkbox"),
      screen.getByRole("button", { name: "Reset image framing" }),
    ])
      expect(control).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Image position" }), {
      target: { value: "right" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Show the whole image" }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Reset image framing" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps two control instances and their native radio groups independent", () => {
    render(
      <>
        <section aria-label="First image">
          <Controlled />
        </section>
        <section aria-label="Second image">
          <Controlled />
        </section>
      </>,
    );
    const first = within(screen.getByRole("region", { name: "First image" }));
    const second = within(screen.getByRole("region", { name: "Second image" }));
    fireEvent.click(second.getByRole("radio", { name: "Show the whole image" }));
    expect(first.getByRole("radio", { name: "Fill the frame" })).toBeChecked();
    expect(second.getByRole("radio", { name: "Show the whole image" })).toBeChecked();
    fireEvent.change(first.getByRole("combobox", { name: "Image position" }), {
      target: { value: "top-left" },
    });
    fireEvent.click(second.getByRole("radio", { name: "Fill the frame" }));
    expect(first.getByRole("combobox", { name: "Image position" })).toHaveValue("top-left");
    expect(second.getByRole("combobox", { name: "Image position" })).toHaveValue("center");
    expect(first.getByLabelText("Image position")).not.toBe(
      second.getByLabelText("Image position"),
    );
  });

  it("can open and close the optional sizing explanation without changing framing", () => {
    const onChange = vi.fn();
    render(<ImageFramingControls onChange={onChange} />);
    const summary = screen.getByText("How image framing works");
    expect(screen.getByRole("group", { name: "Image framing" })).toHaveAccessibleDescription(
      /HTML and ZIP include the full image file and any embedded location data/,
    );
    const details = summary.closest("details")!;
    expect(details.open).toBe(false);
    fireEvent.click(summary);
    expect(details.open).toBe(true);
    fireEvent.click(summary);
    expect(details.open).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});

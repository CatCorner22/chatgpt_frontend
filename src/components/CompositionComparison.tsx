import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Content, Tokens } from "@/lib/design";
import type { BundledFamily } from "@/lib/authored-font-styles";
import { getAuthoredFeatures, hasAuthoredFeatureDescription } from "@/lib/authored-content";
import { renderAuthoredPage, type PageOptions } from "@/lib/render-authored-page";
import { PAGE_COMPOSITIONS, type PageComposition } from "@/lib/page-compositions";
import "./composition-comparison.css";

const tasks = [
  { id: "read", title: "Read a story", pair: ["editorial", "journal"] },
  { id: "decide", title: "Understand an offer", pair: ["studio", "product"] },
  { id: "look", title: "Explore visual work", pair: ["showcase", "studio"] },
] as const;

type Task = (typeof tasks)[number];
type View = "phone" | "desktop" | "first" | "second";

function layoutTitle(id: PageComposition) {
  return PAGE_COMPOSITIONS.find((layout) => layout.id === id)!.title;
}

function describeLayout(id: PageComposition, content: Content, options: PageOptions) {
  const features = getAuthoredFeatures(content.features);
  const hasImage = Boolean(options.image?.alt.trim());
  switch (id) {
    case "editorial":
      return "The headline and introduction lead. Readers follow the sections in order.";
    case "journal":
      return features.length
        ? `The lead sits with a linked index of your ${features.length === 1 ? "one section" : `${features.length} sections`}. Readers can jump straight to a topic.`
        : "A compact masthead leads into the story. Add section details to see a linked index here.";
    case "product":
      return features.some(hasAuthoredFeatureDescription)
        ? "The offer leads into expandable details. Readers can open the points they want to investigate."
        : "The offer leads the page. Add descriptions to your details to let readers expand them.";
    case "showcase":
      return hasImage
        ? "Your image opens the page before the headline. It gives the work space and puts the words farther down."
        : "The statement opens the page. Adding your own lead image would put the work ahead of the words.";
    case "studio":
      return "The headline and visual share the opening on wide screens. The words lead on a phone.";
  }
}

function ComparisonFrame({
  html,
  title,
  size,
}: {
  html: string;
  title: string;
  size: "phone" | "desktop";
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [availableWidth, setWidth] = useState(0);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    setWidth(element.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const width = size === "phone" ? 320 : 1024;
  const height = size === "phone" ? 610 : 740;
  const scale = availableWidth ? Math.min(1, availableWidth / width) : 1;
  return (
    <div className="layout-comparison-stage" ref={stage} style={{ height: height * scale }}>
      <div style={{ width: width * scale, height: height * scale, marginInline: "auto" }}>
        <iframe
          title={title}
          srcDoc={html}
          sandbox=""
          referrerPolicy="no-referrer"
          style={{ width, height, transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
}

type Props = {
  tokens: Tokens;
  content: Content;
  options: PageOptions;
  families: readonly BundledFamily[];
  assetsBlocked: boolean;
  applyBlocked?: boolean;
  onChoose: (id: PageComposition) => void;
};

function OpenComparison({
  tokens,
  content,
  options,
  families,
  assetsBlocked,
  applyBlocked,
  onChoose,
}: Props) {
  const [taskId, setTaskId] = useState<Task["id"]>(() => {
    if (options.composition === "journal" || options.composition === "editorial") return "read";
    if (options.composition === "showcase") return "look";
    return "decide";
  });
  const taskInput = useId();
  const screenInput = useId();
  const [view, setView] = useState<View>("phone");
  const task = tasks.find((item) => item.id === taskId)!;
  const [first, second] = task.pair;
  const previews = useMemo(() => {
    if (assetsBlocked) return null;
    const build = (composition: PageComposition) =>
      renderAuthoredPage(tokens, content, { ...options, composition }, families).html;
    return [build(first), build(second)] as const;
  }, [assetsBlocked, tokens, content, options, families, first, second]);
  const splitLayout = view === "first" ? first : view === "second" ? second : null;
  function applyButton(layout: PageComposition) {
    const current = layout === options.composition;
    const title = layoutTitle(layout);
    return (
      <button
        className="layout-comparison-apply"
        type="button"
        disabled={current || assetsBlocked || applyBlocked}
        onClick={() => onChoose(layout)}
      >
        {current ? `Using ${title}` : `Use ${title} layout`}
      </button>
    );
  }

  return (
    <div className="layout-comparison-body">
      <div className="layout-comparison-filters">
        <div>
          <label htmlFor={taskInput}>What does your visitor want to do?</label>
          <select
            id={taskInput}
            value={taskId}
            onChange={(event) => setTaskId(event.target.value as Task["id"])}
          >
            {tasks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={screenInput}>Compare</label>
          <select
            id={screenInput}
            value={view}
            onChange={(event) => setView(event.target.value as View)}
          >
            <option value="phone">Both layouts on a phone</option>
            <option value="desktop">Both layouts on a desktop</option>
            <option value="first">{layoutTitle(first)} on phone and desktop</option>
            <option value="second">{layoutTitle(second)} on phone and desktop</option>
          </select>
        </div>
      </div>
      {assetsBlocked && (
        <p role="status">Finish preparing the page images to see both layouts with your content.</p>
      )}
      {applyBlocked && (
        <p role="status">
          Resolve the design constraints in the workshop before applying a layout.
        </p>
      )}
      {splitLayout && (
        <div className="layout-comparison-summary">
          <p>
            <strong>{layoutTitle(splitLayout)}</strong>{" "}
            {describeLayout(splitLayout, content, options)}
          </p>
          {applyButton(splitLayout)}
        </div>
      )}
      <div className="layout-comparison-pair">
        {([0, 1] as const).map((index) => {
          const layoutIndex = splitLayout ? (view === "first" ? 0 : 1) : index;
          const layout = task.pair[layoutIndex];
          const title = layoutTitle(layout);
          const size = splitLayout
            ? index === 0
              ? "phone"
              : "desktop"
            : view === "phone"
              ? "phone"
              : "desktop";
          const sizeLabel = size === "phone" ? "Phone · 320 px" : "Desktop · 1024 px";
          return (
            <article key={index} className="layout-comparison-card">
              <header>
                <h3>{splitLayout ? sizeLabel : title}</h3>
                {!splitLayout && <span>{sizeLabel}</span>}
              </header>
              {!splitLayout && <p>{describeLayout(layout, content, options)}</p>}
              {previews && (
                <ComparisonFrame
                  key={layout + size}
                  title={`${title} comparison on ${size}`}
                  size={size}
                  html={previews[layoutIndex]}
                />
              )}
              {!splitLayout && applyButton(layout)}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function CompositionComparison(props: Props) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="layout-comparison">
      <button
        type="button"
        className="layout-comparison-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        Compare layouts with your content
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div id={panelId} hidden={!open}>
        {open && <OpenComparison {...props} />}
      </div>
    </div>
  );
}

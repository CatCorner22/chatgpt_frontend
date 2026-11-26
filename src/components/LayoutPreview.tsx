import { useEffect, useMemo, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePageImage } from "@/hooks/usePageImage";
import { measureAuthoredViewport } from "@/lib/authored-viewport";
import type { Content, Tokens } from "@/lib/design";
import {
  localizeExampleAction,
  measureTrickyLayout,
  trickyLayoutExample,
} from "@/lib/layout-stress-preview";
import { loadAuthoredFontFamilies } from "@/lib/load-authored-fonts";
import { PAGE_COMPOSITIONS } from "@/lib/page-compositions";
import { pageOptionsWithImages } from "@/lib/page-options-with-images";
import type { PageSettings } from "@/lib/page-settings";
import { ComparisonFrame } from "./ComparisonFrame";
import "./layout-preview.css";

type Size = "phone" | "desktop";

async function loadRenderer(heading: string, body: string) {
  const [{ renderAuthoredPage }, families] = await Promise.all([
    import("@/lib/render-authored-page"),
    loadAuthoredFontFamilies(heading, body),
  ]);
  return { renderAuthoredPage, families };
}

function TrickyContentCheck({ html, size }: { html: string; size: Size }) {
  const width = size === "phone" ? 320 : 1024;
  const [result, setResult] = useState<{ html: string; width: number; issues: string[] | null }>();
  useEffect(
    () =>
      measureAuthoredViewport(
        html,
        width,
        size === "phone" ? 610 : 740,
        measureTrickyLayout,
        (issues) => setResult({ html, width, issues }),
        () => setResult({ html, width, issues: null }),
      ),
    [html, width, size],
  );
  const issues = result?.html === html && result.width === width ? result.issues : undefined;
  return (
    <div className="layout-preview-result" role="status" aria-live="polite">
      {issues === undefined ? (
        `Checking the rendered page at ${width} px…`
      ) : issues === null ? (
        "This browser couldn’t measure the preview. Inspect the headline, prices, and booking button as you scroll."
      ) : issues.length ? (
        <>
          <p>At {width} px, take a closer look.</p>
          <ul>
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </>
      ) : (
        `At ${width} px, the headline, all four prices, and the booking button label fit. The page fits horizontally.`
      )}
    </div>
  );
}

type Props = {
  tokens: Tokens;
  content: Content;
  page: PageSettings;
  onReady?: (ready: boolean) => void;
};

export function LayoutPreview({ tokens, content, page, onReady }: Props) {
  const [size, setSize] = useState<Size>("phone");
  const [tricky, setTricky] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadedHtml, setLoadedHtml] = useState("");
  const heading = tokens.headingFont;
  const body = tokens.bodyFont;
  const [fonts, setFonts] = useState<{
    heading: string;
    body: string;
    attempt: number;
    renderer: Awaited<ReturnType<typeof loadRenderer>> | null;
  }>();
  const lead = usePageImage(page.imageId, "layout-preview", () => {});
  const story = usePageImage(page.relatedStory?.imageId ?? null, "layout-preview-story", () => {});

  useEffect(() => {
    if (window.matchMedia?.("(min-width: 900px)").matches) setSize("desktop");
  }, []);
  useEffect(() => {
    let active = true;
    void loadRenderer(heading, body).then(
      (renderer) => {
        if (active) setFonts({ heading, body, attempt, renderer });
      },
      () => {
        if (active) setFonts({ heading, body, attempt, renderer: null });
      },
    );
    return () => {
      active = false;
    };
  }, [heading, body, attempt]);
  const renderer =
    fonts?.heading === heading && fonts.body === body && fonts.attempt === attempt
      ? fonts.renderer
      : undefined;
  const issue = lead.error || story.error;
  const waitingForAssets = !!(
    (page.imageId && !lead.src) ||
    (page.relatedStory?.imageId && !story.src)
  );
  const options = useMemo(
    () => pageOptionsWithImages(page, lead.src, story.src),
    [page, lead.src, story.src],
  );
  const built = useMemo(() => {
    if (!renderer || waitingForAssets || issue) return null;
    const preview = tricky ? trickyLayoutExample(content, options) : { content, options };
    const result = renderer.renderAuthoredPage(
      tokens,
      preview.content,
      preview.options,
      renderer.families,
    );
    return {
      html: tricky ? localizeExampleAction(result.html) : result.html,
      imageIssue: result.readiness.find((item) =>
        ["image", "story-image", "story-link"].includes(item.id),
      )?.message,
    };
  }, [renderer, waitingForAssets, issue, tricky, content, options, tokens]);
  const ready = !!built && loadedHtml === built.html && !built.imageIssue && !tricky;
  useEffect(() => {
    onReady?.(ready);
  }, [onReady, ready]);

  const openStudio = (
    <Link
      to="/"
      search={{ view: "studio", panel: "stratosphere", group: "composition" }}
      state={{ focusLayoutOpen: true }}
      className="garden-text-action"
    >
      Open Studio to make changes
    </Link>
  );
  const title = PAGE_COMPOSITIONS.find((layout) => layout.id === page.composition)!.title;
  return (
    <div className="layout-preview">
      <div className="layout-preview-tools">
        <div role="group" aria-label="Preview screen size" className="layout-preview-sizes">
          <button type="button" aria-pressed={size === "phone"} onClick={() => setSize("phone")}>
            <Smartphone aria-hidden="true" size={16} /> Phone
          </button>
          <button
            type="button"
            aria-pressed={size === "desktop"}
            onClick={() => setSize("desktop")}
          >
            <Monitor aria-hidden="true" size={16} /> Desktop
          </button>
        </div>
        <button
          type="button"
          className="layout-preview-tricky"
          aria-pressed={tricky}
          onClick={() => setTricky(!tricky)}
        >
          Try tricky content
        </button>
      </div>
      {tricky && (
        <p className="layout-preview-note">
          This example has a long headline, four prices, and no lead photo. Select “Try tricky
          content” again to return to your original content and use this layout.
        </p>
      )}
      {issue ? (
        <p role="alert">
          {issue} {openStudio}
        </p>
      ) : renderer === null ? (
        <div role="alert">
          <p>The working preview couldn’t load.</p>
          <button
            type="button"
            className="garden-text-action"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try loading preview again
          </button>
        </div>
      ) : !built ? (
        <p role="status">Preparing the layout preview…</p>
      ) : (
        <>
          {built.imageIssue && (
            <p role="alert">
              {built.imageIssue} {openStudio}
            </p>
          )}
          {tricky && <TrickyContentCheck html={built.html} size={size} />}
          <ComparisonFrame
            html={built.html}
            title={`${title} layout preview on ${size}`}
            size={size}
            onLoad={() => setLoadedHtml(built.html)}
          />
        </>
      )}
    </div>
  );
}

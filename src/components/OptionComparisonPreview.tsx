import { AuthoredPreviewFrame } from "./AuthoredPreviewFrame";
import { useEffect, useState } from "react";
import { getAuthoredFeatures } from "@/lib/authored-content";
import type { Content, Tokens } from "@/lib/design";
import type { PageSettings } from "@/lib/page-settings";
import { loadAuthoredFontFamilies } from "@/lib/load-authored-fonts";

type Props = { content: Content; tokens: Tokens; settings: PageSettings };

function OptionPreviewFrame({ content, tokens, settings }: Props) {
  const [result, setResult] = useState<{
    content: Content;
    tokens: Tokens;
    settings: PageSettings;
    html?: string;
  } | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [{ renderAuthoredPage }, families] = await Promise.all([
          import("@/lib/render-authored-page"),
          loadAuthoredFontFamilies(tokens.headingFont, tokens.bodyFont),
        ]);
        const page = renderAuthoredPage(
          tokens,
          content,
          { ...settings, composition: "comparison" },
          families,
        );
        // Render the same section and stylesheet as the delivered page. Images
        // outside the section are not part of this excerpt.
        const html = `<!doctype html><html lang="${settings.language === "ja" ? "ja" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${page.css}</style></head><body class="comparison"><main class="site-shell">${page.comparisonSection}</main></body></html>`;
        if (active) setResult({ content, tokens, settings, html });
      } catch {
        if (active) setResult({ content, tokens, settings });
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [content, tokens, settings]);
  if (result?.content !== content || result.tokens !== tokens || result.settings !== settings)
    return <p role="status">Preparing your option preview…</p>;
  if (!result.html) return <p role="alert">The preview could not load. Close it and try again.</p>;
  return (
    <AuthoredPreviewFrame
      className="w-full min-w-0 rounded-md border border-border"
      height={350}
      title="Your option comparison preview"
      html={result.html}
    />
  );
}

export function OptionComparisonPreview(props: Props) {
  const [open, setOpen] = useState(false);
  if (getAuthoredFeatures(props.content.features).length < 2)
    return (
      <p>
        Add at least two offers under “Make the words yours” in Studio. Include any price or time
        your visitors need in each description.
      </p>
    );
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="garden-text-action"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Close option preview" : "Preview my options together"}
      </button>
      {open && (
        <>
          <OptionPreviewFrame {...props} />
          {props.settings.actionUrl && <p>Open the downloaded page to try the destination.</p>}
        </>
      )}
    </div>
  );
}

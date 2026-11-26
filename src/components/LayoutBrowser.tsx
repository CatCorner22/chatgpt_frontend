import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, Check } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { LayoutPreview } from "@/components/LayoutPreview";
import { focusLocalStorage } from "@/lib/browser-storage";
import { GALLERY, GALLERY_GROUPS } from "@/lib/gallery";
import { readGardenPreferences } from "@/lib/garden-preferences";
import {
  commitLayoutDraft,
  getLayoutDesign,
  readLayoutDraft,
  type LayoutDraftSnapshot,
} from "@/lib/layout-draft";
import { PAGE_COMPOSITIONS, type PageComposition } from "@/lib/page-compositions";
import "@/styles/layout-browser.css";

const layoutNotes: Record<PageComposition, string> = {
  studio:
    "When the words and image tell the same story, putting them together helps a visitor understand the offer. On a phone, check that the opening sentence still makes sense before the picture appears.",
  editorial:
    "Give the first sentence the job of drawing someone into the story. If visitors usually arrive ready to act, check how far they need to read before they can take that step.",
  product:
    "Start with what someone can do, then let them open the details they care about. Put anything everyone needs to know up front, where they can see it without opening a section.",
  comparison:
    "Use the same kinds of details for each option so people can compare them fairly. On a phone, check that every price or time stays with the offer it belongs to.",
  showcase:
    "Choose a picture that communicates the work at a glance. Try the page without the image, too. The headline should still tell visitors what they can find here.",
  journal:
    "Give each section a distinct name so the index helps people go straight to a topic. If the page is very short, read it from the top and check whether an index earns its space.",
};

export function LayoutBrowser() {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<LayoutDraftSnapshot | null>(null);
  const [layout, setLayout] = useState<PageComposition>("studio");
  const [themeId, setThemeId] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const committing = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);

  const loadWorkspace = useCallback(() => {
    try {
      const next = readLayoutDraft();
      setSnapshot(next);
      setLayout(next.state.page.composition);
      setThemeId("");
      setIssue("");
    } catch (error) {
      setSnapshot(null);
      setIssue(error instanceof Error ? error.message : "Focus couldn’t read your saved design.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    setNotesOpen(!readGardenPreferences(focusLocalStorage).value.brief);
    loadWorkspace();
    if (document.activeElement === document.body) title.current?.focus({ preventScroll: true });
  }, [loadWorkspace]);

  const theme = GALLERY.find((item) => item.id === themeId);
  const design = useMemo(() => getLayoutDesign(snapshot, layout, theme), [snapshot, layout, theme]);
  const [readyDesign, setReadyDesign] = useState<typeof design | null>(null);
  const previewReady = useCallback(
    (ready: boolean) => setReadyDesign(ready ? design : null),
    [design],
  );
  const selected = PAGE_COMPOSITIONS.find((option) => option.id === layout)!;
  const hasWork = snapshot?.hasWork === true;
  const websiteCopyOnly =
    hasWork &&
    (snapshot.state.integration === "existing" || snapshot.state.purpose.experience === "app");
  const canCommit = snapshot !== null && readyDesign === design && !design.blocker && !saved;

  function choose(action: "use" | "copy") {
    if (!snapshot || !canCommit || committing.current) return;
    committing.current = true;
    try {
      commitLayoutDraft(snapshot, layout, theme, action);
    } catch (error) {
      committing.current = false;
      setIssue(error instanceof Error ? error.message : "Focus couldn’t save this layout.");
      return;
    }
    setIssue("");
    setSaved(true);
    // Keep a direct Studio link if client navigation is interrupted after a confirmed save.
    void navigate({ to: "/", search: { view: "studio" }, state: { focusLayoutOpen: true } }).catch(
      () => setIssue("Your layout is saved. Open the design studio to continue."),
    );
  }

  return (
    <div className="layout-browser-page">
      <AppHeader />
      <main id="main-content" className="layout-browser">
        <Link to="/" className="layout-back">
          <ArrowLeft size={17} aria-hidden="true" /> Back to the Garden
        </Link>
        <header className="layout-browser-intro">
          <div>
            <h1 ref={title} tabIndex={-1}>
              Designer layouts
            </h1>
            <p>A layout decides where things go. A theme decides how they look.</p>
          </div>
          <img
            src="/brand/reverie-map-guide.webp"
            width="1254"
            height="1254"
            alt="Reverie reading her map"
            decoding="async"
          />
        </header>
        <div className="layout-browser-workspace">
          <section className="layout-browser-choices" aria-label="Design choices">
            <fieldset className="layout-picker" disabled={saved}>
              <legend>Page layout</legend>
              <div className="layout-picker-grid">
                {PAGE_COMPOSITIONS.map((option) => (
                  <label key={option.id} className="layout-pick">
                    <input
                      type="radio"
                      name="page-layout"
                      value={option.id}
                      checked={layout === option.id}
                      onChange={() => setLayout(option.id)}
                    />
                    <span
                      className={`layout-diagram layout-diagram--${option.id}`}
                      aria-hidden="true"
                    >
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="layout-pick-label">
                      {option.title}
                      {layout === option.id && <Check size={15} aria-hidden="true" />}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="layout-description" aria-live="polite">
              {selected.description}
            </p>
            <button
              className="layout-preview-jump"
              type="button"
              onClick={() => {
                previewHeading.current?.scrollIntoView({ block: "start" });
                previewHeading.current?.focus({ preventScroll: true });
              }}
            >
              See {selected.title} preview <ArrowRight size={15} aria-hidden="true" />
            </button>
            <div className="layout-theme">
              <label htmlFor="layout-theme">Theme</label>
              <select
                id="layout-theme"
                value={themeId}
                disabled={saved}
                onChange={(event) => setThemeId(event.target.value)}
              >
                <option value="">
                  {snapshot?.state.tokens ? "Current theme" : "Sample theme"}
                </option>
                {GALLERY_GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {GALLERY.filter((item) => item.group === group).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.direction.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <details
              className="layout-notes"
              open={notesOpen}
              onToggle={(event) => setNotesOpen(event.currentTarget.open)}
            >
              <summary>
                <BookOpen size={16} aria-hidden="true" /> Reverie’s layout tip
              </summary>
              <p>{layoutNotes[layout]}</p>
            </details>
          </section>
          <section className="layout-browser-preview" aria-labelledby="layout-preview-title">
            <h2 id="layout-preview-title" ref={previewHeading} tabIndex={-1}>
              {selected.title} preview
            </h2>
            <p className="layout-source">
              {hasWork
                ? snapshot.state.content
                  ? "Using your design’s words and images."
                  : "Using your draft’s starting content."
                : "Using the same editable sample for all six layouts."}
            </p>
            {loaded ? (
              <LayoutPreview
                tokens={design.tokens}
                content={design.content}
                page={design.page}
                onReady={previewReady}
              />
            ) : (
              <p role="status">Opening the preview…</p>
            )}
          </section>
          <section className="layout-browser-actions" aria-label="Use the selected layout">
            {websiteCopyOnly && (
              <p>
                This layout can open as a separate website design with your content. Your current
                project keeps its structure.
              </p>
            )}
            {design.blocker && <p role="status">{design.blocker}</p>}
            {issue && (
              <div role="alert">
                <p>{issue}</p>
                {!saved && (
                  <div className="layout-action-buttons">
                    <button type="button" className="layout-retry" onClick={loadWorkspace}>
                      Reload saved draft
                    </button>
                    <Link
                      to="/"
                      search={{ view: "studio" }}
                      state={{ focusLayoutOpen: true }}
                      className="layout-retry"
                    >
                      Open Studio
                    </Link>
                  </div>
                )}
              </div>
            )}
            {saved ? (
              <Link
                to="/"
                search={{ view: "studio" }}
                state={{ focusLayoutOpen: true }}
                className="layout-primary"
              >
                Open design studio <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <div className="layout-action-buttons">
                {!websiteCopyOnly && (
                  <button
                    type="button"
                    className="layout-primary"
                    disabled={!canCommit}
                    onClick={() => choose("use")}
                  >
                    {hasWork ? "Apply to my design" : "Use this layout"}{" "}
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                )}
                {hasWork && (
                  <button
                    type="button"
                    className={websiteCopyOnly ? "layout-primary" : "layout-secondary"}
                    disabled={!canCommit}
                    onClick={() => choose("copy")}
                  >
                    {websiteCopyOnly ? "Start a separate website copy" : "Start a separate copy"}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

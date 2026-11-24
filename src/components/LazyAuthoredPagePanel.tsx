import { Component, lazy, Suspense, type ComponentProps } from "react";
import type { AuthoredPageEditor } from "./AuthoredPageEditor";
import { normalizeTokens } from "@/lib/design";
import { loadAuthoredFontFamilies } from "@/lib/load-authored-fonts";
import { Button } from "@/components/ui/button";

type Props = Omit<ComponentProps<typeof AuthoredPageEditor>, "families">;

function createPanel(heading: string, body: string) {
  return lazy(async () => {
    const [module, families] = await Promise.all([
      import("./AuthoredPageEditor"),
      loadAuthoredFontFamilies(heading, body),
    ]);
    const Editor = module.AuthoredPageEditor;
    return { default: (props: Props) => <Editor {...props} families={families} /> };
  });
}

type LoaderProps = Props & { heading: string; body: string };
type State = { failed: boolean; Panel: ReturnType<typeof createPanel> };

export function LazyAuthoredPagePanel(props: Props) {
  const { headingFont, bodyFont } = normalizeTokens(props.tokens);
  return (
    <PageLoader
      key={JSON.stringify([headingFont, bodyFont])}
      {...props}
      heading={headingFont}
      body={bodyFont}
    />
  );
}

class PageLoader extends Component<LoaderProps, State> {
  override state = { failed: false, Panel: createPanel(this.props.heading, this.props.body) };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    const { failed, Panel } = this.state;
    if (failed) {
      return (
        <div className="space-y-3 rounded-md border border-border bg-card p-4 text-sm">
          <p role="alert">The working page preview and downloads couldn’t load.</p>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              this.setState({
                failed: false,
                Panel: createPanel(this.props.heading, this.props.body),
              })
            }
          >
            Try loading preview again
          </Button>
          <p className="text-muted-foreground">
            If this continues, save your work before refreshing.
          </p>
        </div>
      );
    }
    return (
      <Suspense
        fallback={
          <p role="status" className="rounded-md border border-border bg-card p-4 text-sm">
            Loading the working page preview and download tools…
          </p>
        }
      >
        <Panel {...this.props} />
      </Suspense>
    );
  }
}

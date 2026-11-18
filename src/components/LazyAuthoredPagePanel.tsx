import { Component, lazy, Suspense, type ComponentProps } from "react";
import type { AuthoredPagePanel } from "@/components/AuthoredPagePanel";
import { Button } from "@/components/ui/button";

const loadPanel = () =>
  import("./AuthoredPagePanel").then((module) => ({ default: module.AuthoredPagePanel }));
const createPanel = () => lazy(loadPanel);
type Props = ComponentProps<typeof AuthoredPagePanel>;
type State = { failed: boolean; Panel: ReturnType<typeof createPanel> };

/** The editor and its font catalog load together once a project needs the authored panel. */
export class LazyAuthoredPagePanel extends Component<Props, State> {
  override state = { failed: false, Panel: createPanel() };

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
            onClick={() => this.setState({ failed: false, Panel: createPanel() })}
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

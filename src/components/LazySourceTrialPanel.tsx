import { Component, lazy, Suspense, type ComponentProps } from "react";
import type { SourceTrialPanel } from "@/components/SourceTrialPanel";
import { Button } from "@/components/ui/button";

const createPanel = () =>
  lazy(() => import("./SourceTrialPanel").then((module) => ({ default: module.SourceTrialPanel })));
type Props = ComponentProps<typeof SourceTrialPanel>;
type State = { failed: boolean; Panel: ReturnType<typeof createPanel> };

/** Customer-source parsers load only when the owner opens this optional panel. */
export class LazySourceTrialPanel extends Component<Props, State> {
  override state = { failed: false, Panel: createPanel() };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (this.state.failed)
      return (
        <div className="space-y-3 py-4 text-sm">
          <p role="alert">
            The optional source-change tools couldn’t load. Your Target answers are intact.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => this.setState({ failed: false, Panel: createPanel() })}
          >
            Try loading source tools again
          </Button>
          <p>You can still use the design handoff and prompts.</p>
        </div>
      );
    const { Panel } = this.state;
    return (
      <Suspense
        fallback={
          <p role="status" className="py-4 text-sm">
            Loading optional source-change tools…
          </p>
        }
      >
        <Panel {...this.props} />
      </Suspense>
    );
  }
}

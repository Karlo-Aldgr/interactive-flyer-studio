import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Editor] render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
          <p className="font-display text-lg font-semibold text-foreground">Editor could not load</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {this.state.error.message || "Something crashed while opening this flyer."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" variant="default" onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <Button asChild variant="outline">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

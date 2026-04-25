import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Render error:", error);
    console.error("[ErrorBoundary] Component stack:", info.componentStack);
    this.setState({ info });
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    if (!this.state.error) return this.props.children;

    const { error, info } = this.state;
    return (
      <div className="min-h-screen bg-background p-6 font-mono text-sm">
        <div className="mx-auto max-w-3xl rounded-2xl border border-destructive/30 bg-card p-6 shadow-elegant">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-destructive" />
            <h1 className="font-display text-xl font-bold text-destructive">
              Something broke while rendering
            </h1>
          </div>
          <p className="mb-4 text-muted-foreground">
            The preview crashed. Details below — share these with Lovable to get
            unblocked, or use them to fix the offending file.
          </p>

          <div className="mb-3">
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              Error
            </div>
            <pre className="overflow-auto rounded-lg bg-muted p-3 text-foreground">
              {error.name}: {error.message}
            </pre>
          </div>

          {error.stack && (
            <details className="mb-3" open>
              <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">
                Stack
              </summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
                {error.stack}
              </pre>
            </details>
          )}

          {info?.componentStack && (
            <details className="mb-4">
              <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground">
                Component stack
              </summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">
                {info.componentStack}
              </pre>
            </details>
          )}

          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border border-border bg-background px-4 py-2 hover:bg-muted"
            >
              Reload
            </button>
            <a
              href="/"
              className="rounded-lg border border-border bg-background px-4 py-2 hover:bg-muted"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}

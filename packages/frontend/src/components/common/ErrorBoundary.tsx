import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from 'react';

interface State {
  err: Error | null;
}

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  override state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  override componentDidCatch(err: Error, info: ErrorInfo): void {
    console.error('UI error boundary caught', err, info);
  }

  override render(): ReactNode {
    if (this.state.err) {
      return (
        <div className="p-6 text-sm text-slate-200">
          <div className="mb-2 font-mono text-xs uppercase tracking-wider text-mission-danger">
            something went wrong
          </div>
          <div className="rounded bg-mission-panel p-3 font-mono text-xs text-slate-400">
            {this.state.err.message}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ err: null })}
            className="mt-3 rounded border border-mission-edge px-2 py-1 text-xs hover:bg-mission-edge"
          >
            try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

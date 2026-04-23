import { Component, type ErrorInfo, type ReactNode } from 'react';

import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  /** Where this boundary lives (for the displayed message). */
  scope: string;
  /** Optional reset handler — when the user clicks "Reset", we call this
   *  before clearing local error state so the parent can wipe persisted
   *  state that may be the cause of the loop. */
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error(`[error-boundary:${this.props.scope}]`, error, info);
  }

  private reset = () => {
    this.props.onReset?.();
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <h2>Something crashed in {this.props.scope}.</h2>
            <p className="error-boundary-msg">{this.state.error.message}</p>
            {this.state.error.stack && (
              <pre className="error-boundary-stack">{this.state.error.stack}</pre>
            )}
            <button type="button" className="error-boundary-reset" onClick={this.reset}>
              Reset and reload
            </button>
            <p className="error-boundary-hint">
              If this keeps happening, the saved workspace layout may be corrupted. The reset button
              clears it and reloads the default layout.
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

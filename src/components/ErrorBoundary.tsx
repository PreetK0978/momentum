import { Component, type ReactNode } from 'react';

/** Keeps a crash in one page from blanking the whole app. Data in IndexedDB is unaffected. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card mx-auto mt-10 max-w-lg p-6 text-center">
        <h2 className="text-base font-semibold">This page hit an unexpected error</h2>
        <p className="mt-2 text-sm text-muted">Your data is safe. Try reloading; if it keeps happening, export a backup from Settings.</p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-bg/60 p-3 text-left text-xs text-subtle">{this.state.error.message}</pre>
        <button className="btn-primary mt-4" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}

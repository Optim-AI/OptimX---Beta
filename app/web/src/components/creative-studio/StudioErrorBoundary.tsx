import React from 'react';

type Props = { children: React.ReactNode; label?: string };
type State = { error: Error | null };

export default class StudioErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[StudioErrorBoundary:${this.props.label || 'studio'}]`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex items-center justify-center p-8" style={{ background: '#0B0B0F', color: '#F4F4F7' }}>
          <div className="max-w-lg">
            <p className="text-sm font-medium mb-2" style={{ color: '#F87171' }}>
              {this.props.label || 'Studio'} failed to render
            </p>
            <pre className="text-[11px] whitespace-pre-wrap break-words opacity-80">
              {this.state.error.message}
              {'\n'}
              {this.state.error.stack}
            </pre>
            <button
              type="button"
              className="mt-4 px-3 py-1.5 rounded text-xs"
              style={{ background: '#A855F7' }}
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

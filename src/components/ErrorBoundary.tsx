import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public props: Props;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled UI Exception caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-950 text-slate-100">
          <div className="p-4 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          <p className="text-sm text-slate-400 max-w-md">
            An unexpected error occurred while rendering the page. Your writing drafts and submissions are safely stored on this device.
          </p>
          {this.state.error?.message && (
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs text-red-300 max-w-lg overflow-x-auto">
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={this.handleReload}
            className="gradient-btn px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center shadow-lg hover:scale-105 transition-transform"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload & Recover Workspace
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

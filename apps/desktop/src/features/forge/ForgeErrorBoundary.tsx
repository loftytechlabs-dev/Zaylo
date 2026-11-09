import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ForgeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ForgeErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full bg-[#0c0d10] text-zinc-100 flex flex-col items-center justify-center p-8 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="text-center max-w-md space-y-1">
            <h2 className="text-lg font-bold text-zinc-100">Forge Interface Error</h2>
            <p className="text-xs text-zinc-400">
              An unexpected render issue occurred in this Forge view. Your fine-tuning processes and saved models remain safe on disk.
            </p>
          </div>

          {this.state.error && (
            <div className="max-w-lg w-full p-3 rounded-lg bg-[#14161a] border border-[#232630] font-mono text-[11px] text-rose-300 overflow-x-auto max-h-36">
              {this.state.error.message || String(this.state.error)}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-semibold shadow-md transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Recover & Reload</span>
            </button>
            <button
              onClick={() => {
                this.handleReset();
                window.location.reload();
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1c22] hover:bg-[#242730] border border-[#2b2e38] text-zinc-300 text-xs font-medium transition-colors"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Full App Reload</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  readonly props: Props;
  state: State = {
    hasError: false,
    error: null,
  };

  constructor(props: Props) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070707] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-xl space-y-8 glass p-12 border-red-500/20 shadow-2xl">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-white uppercase tracking-tighter text-red-500">System Fault</h1>
              <p className="text-red-500/60 text-[10px] uppercase tracking-[0.4em] font-black">Runtime Exception Detected</p>
            </div>
            
            <div className="space-y-4 py-4 border-y border-white/20">
              <p className="text-white text-sm leading-relaxed">
                "The production engine encountered an unexpected error. Please refresh the page to restart the vault."
              </p>
              <div className="bg-black/40 p-4 rounded text-left overflow-auto max-h-48">
                <code className="text-red-400 text-[10px] font-mono break-all">
                  {this.state.error?.message || 'Unknown Error'}
                </code>
              </div>
            </div>

            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-white text-black px-12 py-5 rounded-sm font-black uppercase tracking-[0.3em] text-[11px] hover:bg-neutral-200 transition-all active:scale-[0.98]"
            >
              Restart Engine
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

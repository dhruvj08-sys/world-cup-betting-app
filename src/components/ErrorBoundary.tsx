import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Zap } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <Zap className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-black uppercase tracking-widest text-white mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-400 mb-6 font-medium">An unexpected error occurred in this view. Please try refreshing or returning to the dashboard.</p>
            <button 
              onClick={() => {
                // @ts-ignore
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="bg-white text-black px-6 py-3 rounded-full text-sm font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}

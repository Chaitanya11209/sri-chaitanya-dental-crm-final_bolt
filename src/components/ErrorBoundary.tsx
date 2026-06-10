import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut, ArrowLeft, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    console.error('[ErrorBoundary] Uncaught react runtime error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/crm/dashboard';
  };

  private handleBackToHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div id="error-boundary-screen" className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6 font-sans">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-rose-500 to-amber-500" />
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 flex items-center justify-center text-rose-400 border border-rose-500/20">
                <ShieldAlert size={28} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white">CRM Application Error Detected</h1>
                <p className="text-slate-400 text-xs mt-0.5">The interface encountered an unexpected runtime exception in the web workspace.</p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800/80 p-5 font-mono text-xs text-slate-300 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold border-b border-slate-800 pb-2">
                <AlertTriangle size={14} />
                <span>Error details:</span>
              </div>
              <p className="font-semibold text-slate-100 whitespace-pre-wrap break-words fill-none">
                {this.state.error?.name || 'Exception'}: {this.state.error?.message || 'Unknown fatal crash'}
              </p>
              {this.state.errorInfo?.componentStack && (
                <div className="space-y-1">
                  <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Failed Component Stack:</p>
                  <pre className="h-32 overflow-y-auto text-[10px] text-slate-400 bg-black/30 p-2.5 rounded-lg whitespace-pre-wrap break-words leading-relaxed">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>

            {/* Practical mitigation guidelines for clinical staff */}
            <div className="mt-6 border-t border-slate-800 pt-5 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                If syncing failed because of network packet dropouts, or active database Row Level Security policy updates in the security migrations, attempt a hard-refresh.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={this.handleReset}
                  className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md shadow-teal-505/10 transition cursor-pointer"
                >
                  <RefreshCw size={13} />
                  Reload Dashboard
                </button>
                <button
                  onClick={this.handleBackToHome}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-slate-750 transition cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  Back to Website
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('userEmail');
                    localStorage.removeItem('userRole');
                    localStorage.removeItem('gdrive_access_token');
                    window.location.href = '/admin';
                  }}
                  className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-rose-900/30 ml-auto transition cursor-pointer"
                >
                  <LogOut size={13} />
                  Log Out Session
                </button>
              </div>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut, ArrowLeft, ShieldAlert } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    const errMsg = (error && (error.message || String(error) || '')).toLowerCase();
    const isBenign = !errMsg ||
                     errMsg.includes('script error') ||
                     errMsg.includes('scripterror') ||
                     errMsg.includes('resizeobserver') ||
                     errMsg.includes('extension');
    if (isBenign) {
      return { hasError: false, error: null, errorInfo: null };
    }
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errMsg = (error && (error.message || String(error) || '')).toLowerCase();
    const isBenign = !errMsg ||
                     errMsg.includes('script error') ||
                     errMsg.includes('scripterror') ||
                     errMsg.includes('resizeobserver') ||
                     errMsg.includes('extension');
    if (isBenign) {
      this.setState({ hasError: false, error: null, errorInfo: null });
      return;
    }
    this.setState({
      error,
      errorInfo,
    });
    console.error('[ErrorBoundary] Uncaught react runtime error:', error, errorInfo);
  }

  public handleReset = () => {
    try {
      this.setState({ hasError: false, error: null, errorInfo: null });
      if (typeof window !== 'undefined') {
        window.location.href = '/crm/dashboard';
      }
    } catch (err) {
      console.warn('[ErrorBoundary] Reset navigation blocked, attempting replace:', err);
      try {
        if (typeof window !== 'undefined') {
          window.location.replace('/crm/dashboard');
        }
      } catch (inner) {
        console.error('[ErrorBoundary] Reset fallback redirect failed:', inner);
      }
    }
  };

  public handleBackToHome = () => {
    try {
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (err) {
      console.warn('[ErrorBoundary] Back-to-home navigation blocked, attempting replace:', err);
      try {
        if (typeof window !== 'undefined') {
          window.location.replace('/');
        }
      } catch (inner) {
        console.error('[ErrorBoundary] Back-to-home fallback redirect failed:', inner);
      }
    }
  };

  public handleLogout = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        ['crmAuthMode', 'userEmail', 'userName', 'userRole', 'adminLoggedIn', 'gdrive_access_token'].forEach(key => {
          window.localStorage.removeItem(key);
        });
        
        // Remove Supabase related storage cache keys cleanly
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => {
          try {
            window.localStorage.removeItem(key);
          } catch (e) {
            console.warn('[ErrorBoundary] Failed to remove key: ' + key, e);
          }
        });
      }
    } catch (err) {
      console.warn('[ErrorBoundary] Clean session storage error in sandbox:', err);
    }
    
    try {
      if (typeof window !== 'undefined') {
        window.location.href = '/admin';
      }
    } catch (err) {
      console.warn('[ErrorBoundary] Logout navigation blocked, attempting replace:', err);
      try {
        if (typeof window !== 'undefined') {
          window.location.replace('/admin');
        }
      } catch (inner) {
        console.error('[ErrorBoundary] Logout fallback redirect failed:', inner);
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6 font-sans" id="error-boundary-screen">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden" id="error-boundary-card">
            
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-rose-500 to-amber-500" />
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 flex items-center justify-center text-rose-400 border border-rose-500/20">
                <ShieldAlert size={28} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold tracking-tight text-white">An unexpected error occurred</h1>
                <p className="text-slate-400 text-xs mt-0.5">We apologize for the inconvenience. Please reload the dashboard or return home.</p>
              </div>
            </div>

            <div className="bg-slate-950 rounded-2xl border border-slate-800/80 p-5 font-mono text-xs text-slate-300 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold border-b border-slate-800 pb-2">
                <AlertTriangle size={14} />
                <span>Error Details:</span>
              </div>
              <p className="font-semibold text-slate-100 whitespace-pre-wrap break-words">
                {this.state.error?.name || 'Exception'}: {this.state.error?.message || 'Unknown runtime error'}
              </p>
              {this.state.errorInfo?.componentStack && (
                <div className="space-y-1">
                  <p className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Component Stack:</p>
                  <pre className="h-32 overflow-y-auto text-[10px] text-slate-400 bg-black/30 p-2.5 rounded-lg whitespace-pre-wrap break-words leading-relaxed">
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              )}
            </div>

            {/* Practical guidelines for clinical staff */}
            <div className="mt-6 border-t border-slate-800 pt-5 space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                If reloading does not resolve the issue, please try logging out and logging back in, or contact your portal administrator.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                   onClick={this.handleReset}
                   className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md shadow-teal-500/10 transition cursor-pointer"
                   id="error-boundary-reset"
                >
                  <RefreshCw size={13} />
                  Reload Dashboard
                </button>
                <button
                   onClick={this.handleBackToHome}
                   className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                   id="error-boundary-home"
                >
                  <ArrowLeft size={13} />
                  Back to Website
                </button>
                <button
                   onClick={this.handleLogout}
                   className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-rose-900/30 ml-auto transition cursor-pointer"
                   id="error-boundary-logout"
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

    return this.props.children || null;
  }
}

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: Date;
  details?: string;
}

interface NotificationContextProps {
  notifications: NotificationItem[];
  notify: (type: NotificationType, title: string, description: string, details?: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const notify = (type: NotificationType, title: string, description: string, details?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification: NotificationItem = {
      id,
      type,
      title,
      description,
      timestamp: new Date(),
      details,
    };
    
    setNotifications((prev) => [newNotification, ...prev].slice(0, 8)); // Max 8 toasts visible at a time
  };

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  // Automatically listen to global unhandled exception and promise rejection triggers (e.g. Supabase RLS crashes, offline exceptions)
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.warn('[Global Capture] Intercepted unhandled promise rejection:', event.reason);
      
      const errorMsg = event.reason?.message || String(event.reason || '');
      if (!errorMsg || errorMsg === 'undefined' || errorMsg === 'null') {
        return; // Ignore empty / undefined rejections
      }

      const isBenignNoise = 
        errorMsg.includes('ResizeObserver') || 
        errorMsg.includes('Extension') || 
        errorMsg.toLowerCase().includes('script error') ||
        errorMsg.toLowerCase().includes('resizeobserver');

      if (isBenignNoise) return;

      let heading = 'Database or API Sync Failure';
      let description = 'A background transaction failed. Your database state may not have resolved correctly.';
      let verboseDetails = undefined;

      // Extract details about row level security if present
      if (errorMsg.toLowerCase().includes('row-level security') || errorMsg.toLowerCase().includes('rls')) {
        heading = 'Row-Level Security (RLS) Restriction';
        description = 'The database operation was blocked because you do not have sufficient staff roles or write permissions for this table.';
      } else if (errorMsg.toLowerCase().includes('google drive') || errorMsg.toLowerCase().includes('gdrive')) {
        heading = 'Google Backup Conflict';
        description = 'Failed to push the compiled snapshot ZIP to your Google Drive account. Check settings/access tokens.';
      } else if (errorMsg.toLowerCase().includes('fetch') || errorMsg.toLowerCase().includes('network')) {
        heading = 'Network Connection Drop';
        description = 'Could not contact the database or cloud backup servers. Please check your internet connection.';
      }

      if (event.reason?.details) {
        verboseDetails = event.reason.details;
      } else if (event.reason?.hint) {
        verboseDetails = `Hint: ${event.reason.hint}`;
      } else if (event.reason?.code) {
        verboseDetails = `Error Code: ${event.reason.code}`;
      }

      notify('error', heading, errorMsg, verboseDetails);
    };

    const handleWindowError = (event: ErrorEvent) => {
      console.warn('[Global Capture] Intercepted runtime window error:', event.error);
      const msg = (event.message || '').toLowerCase();
      const errMsg = (event.error?.message || '').toLowerCase();
      
      const isBenignNoise = 
        !msg ||
        msg === 'undefined' ||
        msg === 'null' ||
        msg.includes('resizeobserver') || 
        msg.includes('extension') || 
        msg.includes('script error') ||
        msg.includes('scripterror') ||
        errMsg.includes('script error') ||
        errMsg.includes('scripterror') ||
        errMsg.includes('resizeobserver') ||
        errMsg.includes('extension');
        
      if (isBenignNoise) return;

      notify(
        'error', 
        'Application Runtime Error', 
        event.message || 'An unexpected runtime error occurred.', 
        event.error?.stack ? String(event.error.stack).substring(0, 150) + '...' : undefined
      );
    };

    const handleSMSFailed = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      notify(
        'error',
        'SMS Transmission Failed',
        `Unsuccessful transmission to ${detail.name || 'Patient'} (${detail.phone || 'N/A'})`,
        `Error log reference: ${detail.error || 'Gateway returned non-200 connection status'}`
      );
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleWindowError);
    window.addEventListener('sms-failed', handleSMSFailed);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('sms-failed', handleSMSFailed);
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss, clearAll }}>
      {children}
      
      {/* Absolute high-contrast portal viewport for toast floating cards */}
      <div 
        id="global-toast-viewport"
        className="fixed top-5 right-5 z-[9999] w-full max-w-sm sm:max-w-md space-y-3 pointer-events-none p-4"
      >
        {notifications.map((toast) => (
          <NotificationToast key={toast.id} item={toast} onDismiss={dismiss} />
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

// ── INTERNAL COMPONENT: Toast item card with auto-dismiss timers ──────────────────
function NotificationToast({ item, onDismiss }: { item: NotificationItem; onDismiss: (id: string) => void }) {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Keep error toasts persistent so they don't disappear before clinical staff can read the error logs!
    // Success / Info toasts dismiss after 6.5 seconds.
    if (item.type === 'error') return;

    const timer = setTimeout(() => {
      onDismiss(item.id);
    }, 6500);

    return () => clearTimeout(timer);
  }, [item, onDismiss]);

  const getStyle = () => {
    switch (item.type) {
      case 'success':
        return {
          bg: 'bg-emerald-50 border-emerald-200/80',
          border: 'border-l-4 border-l-emerald-500',
          iconColor: 'text-emerald-500',
          titleColor: 'text-emerald-950',
          descColor: 'text-emerald-700',
          icon: <CheckCircle2 size={18} />
        };
      case 'error':
        return {
          bg: 'bg-rose-50 border-rose-250',
          border: 'border-l-4 border-l-rose-500',
          iconColor: 'text-rose-500',
          titleColor: 'text-rose-950',
          descColor: 'text-rose-800',
          icon: <AlertCircle size={18} />
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 border-amber-250',
          border: 'border-l-4 border-l-amber-500',
          iconColor: 'text-amber-500',
          titleColor: 'text-amber-950',
          descColor: 'text-amber-800',
          icon: <AlertTriangle size={18} />
        };
      case 'info':
      default:
        return {
          bg: 'bg-sky-50 border-sky-200',
          border: 'border-l-4 border-l-sky-500',
          iconColor: 'text-sky-500',
          titleColor: 'text-sky-950',
          descColor: 'text-sky-800',
          icon: <Info size={18} />
        };
    }
  };

  const style = getStyle();

  return (
    <div
      id={`notification-toast-${item.id}`}
      className={`w-full pointer-events-auto rounded-2xl p-4 border shadow-xl flex items-start gap-3 transition-all duration-300 transform translate-x-0 animate-slideIn ${style.bg} ${style.border}`}
    >
      <div className={`${style.iconColor} flex-shrink-0 mt-0.5`}>
        {style.icon}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-xs font-extrabold ${style.titleColor} leading-tight`}>
          {item.title}
        </p>
        <p className={`text-[11px] font-medium leading-relaxed mt-1 ${style.descColor} break-words`}>
          {item.description}
        </p>

        {item.details && (
          <div className="mt-2 text-left">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-[9px] font-black uppercase tracking-wider text-teal-700 hover:underline cursor-pointer"
            >
              {showDetails ? 'Hide Diagnostics' : 'Show Diagnostic logs'}
            </button>
            {showDetails && (
              <pre className="mt-1.5 p-2 bg-black/5 rounded-lg border border-black/[0.05] overflow-x-auto text-[9px] text-slate-700 font-mono leading-normal whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                {item.details}
              </pre>
            )}
          </div>
        )}
      </div>

      <button
        onClick={() => onDismiss(item.id)}
        className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-black/5 transition flex-shrink-0 cursor-pointer"
      >
        <X size={12} />
      </button>
    </div>
  );
}

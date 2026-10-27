import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerPwaServiceWorker, initInstallPromptListener } from './pwa/pwaManager';

// Initialize PWA service worker lifecycle & install prompt listener
registerPwaServiceWorker();
initInstallPromptListener();

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("SmartAttend-AI UI Error caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-dvh bg-[#F8FAF9] text-[#111827] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center justify-center">
              <img src="/smartattend_logo.png" alt="SmartAttend" className="w-14 h-14 object-contain" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Application Initialization Notice</h2>
            <p className="text-xs text-slate-600">
              A UI rendering notice occurred. You can reload or reset your active session.
            </p>
            <pre className="text-[11px] font-mono bg-slate-50 p-3 rounded-xl text-slate-700 text-left overflow-x-auto border border-slate-200">
              {this.state.error?.toString()}
            </pre>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('smartattend_current_user');
                  window.location.reload();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#1A4731] hover:bg-[#123323] text-xs font-bold text-white transition shadow-md shadow-emerald-900/20"
              >
                Reset &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

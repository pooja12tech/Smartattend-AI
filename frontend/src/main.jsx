import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

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
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full p-6 rounded-2xl bg-slate-900 border border-rose-500/30 space-y-4 shadow-2xl">
            <h2 className="text-lg font-bold text-rose-400">Application Initialization Notice</h2>
            <p className="text-xs text-slate-400">
              A UI rendering error occurred. You can reset session caches and reload cleanly.
            </p>
            <pre className="text-[11px] font-mono bg-slate-950 p-3 rounded-lg text-rose-300 text-left overflow-x-auto border border-slate-800">
              {this.state.error?.toString()}
            </pre>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('smartattend_current_user');
                  window.location.reload();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white transition shadow-lg shadow-brand-500/25"
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

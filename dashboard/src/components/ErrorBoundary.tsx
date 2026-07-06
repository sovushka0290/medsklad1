import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-100 dark:border-slate-700 text-center">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl inline-block mb-4">
              <AlertOctagon className="w-12 h-12 text-rose-600 dark:text-rose-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Что-то пошло не так</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Произошла непредвиденная ошибка при отрисовке интерфейса.
            </p>
            {this.state.error && (
              <pre className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl text-left text-xs font-mono text-rose-600 dark:text-rose-400 overflow-x-auto mb-6 max-h-40">
                {this.state.error.toString()}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-semibold shadow-sm flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

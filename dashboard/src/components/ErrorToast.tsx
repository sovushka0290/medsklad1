import { useEffect, useState } from 'react';

interface Toast {
  id: number;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  visible: boolean;
}

const ICONS = {
  error: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="#F87171" strokeWidth="1.5" />
      <path d="M10 6v4M10 13.5h.01" stroke="#F87171" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  warning: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M9.13 3.25 1.93 16.25A1 1 0 0 0 2.8 17.75h14.4a1 1 0 0 0 .87-1.5L10.87 3.25a1 1 0 0 0-1.74 0Z" stroke="#FBBF24" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 8.5v3.5M10 14.5h.01" stroke="#FBBF24" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="#60A5FA" strokeWidth="1.5" />
      <path d="M10 9v5M10 6.5h.01" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

const COLORS = {
  error: {
    border: '#EF4444',
    glow: 'rgba(239,68,68,0.18)',
    badge: '#7F1D1D',
    badgeFg: '#FCA5A5',
  },
  warning: {
    border: '#F59E0B',
    glow: 'rgba(245,158,11,0.15)',
    badge: '#78350F',
    badgeFg: '#FDE68A',
  },
  info: {
    border: '#3B82F6',
    glow: 'rgba(59,130,246,0.15)',
    badge: '#1E3A5F',
    badgeFg: '#93C5FD',
  },
};

const AUTO_DISMISS_MS = 8000;

export const ErrorToastContainer = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, type, title, message } = (e as CustomEvent).detail;
      setToasts((prev) => [...prev, { id, type, title, message, visible: true }]);

      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
        );
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 400);
      }, AUTO_DISMISS_MS);
    };

    window.addEventListener('medsklad:toast', handler);
    return () => window.removeEventListener('medsklad:toast', handler);
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 400);
  };

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '440px',
        width: '100%',
      }}
    >
      {toasts.map((toast) => {
        const c = COLORS[toast.type];
        return (
          <div
            key={toast.id}
            style={{
              background: 'rgba(10, 22, 40, 0.97)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${c.border}`,
              borderRadius: '12px',
              padding: '14px 16px',
              boxShadow: `0 4px 24px ${c.glow}, 0 1px 3px rgba(0,0,0,0.4)`,
              transform: toast.visible ? 'translateX(0)' : 'translateX(110%)',
              opacity: toast.visible ? 1 : 0,
              transition: 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.35s ease',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              fontFamily: "'Roboto', sans-serif",
            }}
          >
            {/* Icon */}
            <div style={{ flexShrink: 0, marginTop: '1px' }}>{ICONS[toast.type]}</div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: '#F1F5F9',
                  fontWeight: 600,
                  fontSize: '14px',
                  lineHeight: '1.3',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                {toast.title}
              </div>

              {toast.message && (
                <pre
                  style={{
                    margin: 0,
                    color: '#94A3B8',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: "'Roboto Mono', monospace",
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '6px',
                    padding: '6px 8px',
                    maxHeight: '140px',
                    overflowY: 'auto',
                  }}
                >
                  {toast.message}
                </pre>
              )}
            </div>

            {/* Close */}
            <button
              onClick={() => dismiss(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#475569',
                fontSize: '18px',
                lineHeight: 1,
                padding: '0 2px',
                flexShrink: 0,
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#CBD5E1')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
              title="Закрыть"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
};

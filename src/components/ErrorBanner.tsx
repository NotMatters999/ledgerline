import React, { useEffect } from 'react';

interface ErrorBannerProps {
    error: string | null;
    onClear: () => void;
    durationMs?: number;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onClear, durationMs = 0 }) => {
    useEffect(() => {
        // durationMs = 0 means no auto-dismiss (user must click ×).
        // Pass a positive value for toast-style transient messages.
        if (!error || durationMs <= 0) return;

        const timer = setTimeout(() => {
            onClear();
        }, durationMs);

        return () => clearTimeout(timer);
    }, [error, onClear, durationMs]);

    if (!error) return null;

    return (
        <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'rgba(239, 68, 68, 0.2)',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderRadius: '0.75rem',
            padding: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="var(--status-danger)" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p style={{ color: 'var(--status-danger)', fontSize: '0.875rem', margin: 0, fontWeight: 500 }}>
                    {error}
                </p>
            </div>
            <button onClick={onClear} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--status-danger)', padding: '0.25rem', display: 'flex', alignItems: 'center'
            }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};

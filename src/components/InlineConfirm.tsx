import React from 'react';

interface Props {
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'stacked' | 'inline';
}

export const InlineConfirm: React.FC<Props> = ({
    message,
    confirmText = 'Delete',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    variant = 'inline',
}) => {
    if (variant === 'stacked') {
        return (
            <div style={{
                padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '2px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--status-danger)', marginBottom: '0.4rem' }}>
                    {message}
                </p>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                        style={{ ...btnStyle('var(--status-danger)'), flex: 1 }}>
                        {confirmText}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onCancel(); }}
                        style={{ ...btnStyle('rgba(255,255,255,0.1)', 'var(--text-muted)'), flex: 1 }}>
                        {cancelText}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            display: 'inline-flex', gap: '0.25rem', alignItems: 'center',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            padding: '0.25rem 0.5rem', borderRadius: '0.5rem'
        }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--status-danger)', marginRight: '0.5rem' }}>{message}</span>
            <button
                onClick={(e) => { e.stopPropagation(); onConfirm(); }}
                style={btnStyle('var(--status-danger)')}
            >
                {confirmText}
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                style={btnStyle('rgba(255,255,255,0.1)', 'var(--text-muted)')}
            >
                {cancelText}
            </button>
        </div>
    );
};

// Internal style helper
function btnStyle(bg: string, color = '#fff'): React.CSSProperties {
    return {
        fontSize: '0.75rem', padding: '0 0.4rem', height: '26px',
        borderRadius: '0.375rem', background: bg, color,
        border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    };
}

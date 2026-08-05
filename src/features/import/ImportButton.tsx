import React, { useState } from 'react';
import { importPreview, importCommit, PreviewResult } from '../../lib/ipc/import';
import { useFinancialsStore } from '../../store/financials';
import { useCohortStore } from '../../store/cohort';
import { useWorkspaceStore } from '../../store/workspace';
import { open } from '@tauri-apps/plugin-dialog';

type Phase =
    | { tag: 'idle' }
    | { tag: 'loading'; message: string }
    | { tag: 'preview'; result: PreviewResult; filePath: string }
    | { tag: 'committing' }
    | { tag: 'success'; rowCount: number }
    | { tag: 'error'; message: string };

export const ImportButton: React.FC = () => {
    const [phase, setPhase] = useState<Phase>({ tag: 'idle' });
    const fetchFinancials = useFinancialsStore(s => s.fetchData);
    const fetchCohort = useCohortStore(s => s.fetchData);

    const activeWorkspaceId = useWorkspaceStore(s => s.activeId);

    const openPicker = async () => {
        if (!activeWorkspaceId) return;
        try {
            const selected = await open({
                multiple: false,
                filters: [{ name: 'Data Files', extensions: ['csv', 'xlsx', 'xls'] }]
            });
            if (selected === null) return;
            
            const filePath = selected as string;
            setPhase({ tag: 'loading', message: 'Analyzing file…' });
            const result = await importPreview(filePath);
            setPhase({ tag: 'preview', result, filePath });
        } catch (err: any) {
            setPhase({ tag: 'error', message: err instanceof Error ? err.message : (typeof err === 'string' ? err : (JSON.stringify(err) || String(err))) });
        }
    };

    const onCommit = async () => {
        if (phase.tag !== 'preview') return;
        const { filePath } = phase;
        setPhase({ tag: 'committing' });
        try {
            const rowCount = await importCommit(filePath);
            setPhase({ tag: 'success', rowCount });
            // Refresh all data stores
            await Promise.all([
                fetchFinancials(),
                fetchCohort(),
            ]);
        } catch (err: any) {
            setPhase({ tag: 'error', message: err instanceof Error ? err.message : (typeof err === 'string' ? err : (JSON.stringify(err) || String(err))) });
        }
    };

    const onClose = () => setPhase({ tag: 'idle' });

    const hasModal = phase.tag !== 'idle';

    return (
        <>
            {/* Nav button */}
            <button
                id="import-btn"
                onClick={openPicker}
                disabled={!activeWorkspaceId || phase.tag === 'loading' || phase.tag === 'committing'}
                style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.375rem 0.875rem',
                    borderRadius: '0.5rem',
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    transition: 'all var(--transition-fast)',
                    whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.2)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.45)';
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.1)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(16,185,129,0.25)';
                }}
            >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Import Data
            </button>

            {/* Modal overlay */}
            {hasModal && (
                <div
                    id="import-modal-overlay"
                    onClick={e => { if (e.target === e.currentTarget && phase.tag !== 'committing') onClose(); }}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 10000,
                        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '1.5rem',
                    }}
                >
                    <div
                        id="import-modal"
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-highlight)',
                            borderRadius: '1.25rem',
                            boxShadow: 'var(--shadow-lg)',
                            width: '100%', maxWidth: '780px',
                            maxHeight: '85vh',
                            display: 'flex', flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Modal header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '1.25rem 1.5rem',
                            borderBottom: '1px solid var(--border-color)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '32px', height: '32px', borderRadius: '0.5rem',
                                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--accent-primary)" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                                        Import Data
                                    </h2>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                                        Supports .csv, .xls, and .xlsx files
                                    </p>
                                </div>
                            </div>
                            {phase.tag !== 'committing' && (
                                <button onClick={onClose} style={{
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    color: 'var(--text-muted)', padding: '0.25rem', borderRadius: '0.375rem',
                                    display: 'flex', alignItems: 'center',
                                    transition: 'color var(--transition-fast)',
                                }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                                >
                                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Modal body */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                            <ModalBody phase={phase} onCommit={onCommit} onClose={onClose} />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ─── Modal body by phase ──────────────────────────────────────────────────────

const ModalBody: React.FC<{
    phase: Phase;
    onCommit: () => void;
    onClose: () => void;
}> = ({ phase, onCommit, onClose }) => {

    if (phase.tag === 'loading') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem 0' }}>
                <div className="spinner" />
                <p className="text-muted">{phase.message}</p>
            </div>
        );
    }

    if (phase.tag === 'committing') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem 0' }}>
                <div className="spinner" />
                <p className="text-muted">Importing rows into database…</p>
            </div>
        );
    }

    if (phase.tag === 'error') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{
                    padding: '1rem 1.25rem', borderRadius: '0.75rem',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                }}>
                    <p style={{ color: 'var(--status-danger)', fontWeight: 600, marginBottom: '0.375rem', fontSize: '0.9rem' }}>
                        Import failed
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {phase.message}
                    </p>
                </div>
                <button onClick={onClose} style={primaryBtnStyle('rgba(255,255,255,0.08)', 'var(--text-secondary)')}>
                    Close
                </button>
            </div>
        );
    }

    if (phase.tag === 'success') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', padding: '2rem 0' }}>
                <div style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="var(--accent-primary)" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.375rem' }}>
                        Import successful
                    </p>
                    <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                        {phase.rowCount} rows imported. All charts have been refreshed.
                    </p>
                </div>
                <button id="import-success-close" onClick={onClose} style={primaryBtnStyle('var(--accent-primary)', '#000')}>
                    Done
                </button>
            </div>
        );
    }

    if (phase.tag === 'preview') {
        const { result } = phase;
        const rows = result.sample_normalized;
        const cols = result.mapped_columns;

        const detectedFields: string[] = [];
        if (cols.customer_id_idx !== null) detectedFields.push('Customer ID');
        if (cols.revenue_idx !== null) detectedFields.push('Revenue');
        if (cols.date_idx !== null) detectedFields.push('Date');
        if (cols.currency_idx !== null) detectedFields.push('Currency');
        if (cols.category_idx !== null) detectedFields.push('Category');

        const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Detected columns pill row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Detected:
                    </span>
                    {detectedFields.map(f => (
                        <span key={f} style={{
                            padding: '0.2rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 500,
                            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                            color: 'var(--accent-primary)',
                        }}>
                            ✓ {f}
                        </span>
                    ))}
                    {result.date_format && (
                        <span style={{
                            padding: '0.2rem 0.625rem', borderRadius: '9999px', fontSize: '0.75rem',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)',
                            color: 'var(--text-muted)',
                        }}>
                            Date format: {result.date_format}
                        </span>
                    )}
                </div>

                {/* Row count summary */}
                <div style={{
                    padding: '0.875rem 1.125rem', borderRadius: '0.75rem',
                    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="var(--accent-primary)" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Previewing <strong style={{ color: 'var(--text-primary)' }}>{rows.length}</strong> sample rows.
                        Full file contains <strong style={{ color: 'var(--text-primary)' }}>{result.total_rows.toLocaleString()}</strong> rows — all will be imported on confirm.
                    </p>
                </div>

                {/* Preview table */}
                <div style={{ overflowX: 'auto', borderRadius: '0.75rem', border: '1px solid var(--border-color)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)' }}>
                                {['#', 'Customer ID', 'Date', 'Amount', 'Currency', 'Category'].map(h => (
                                    <th key={h} style={{
                                        padding: '0.625rem 0.875rem', textAlign: 'left',
                                        color: 'var(--text-muted)', fontWeight: 600,
                                        fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                                        whiteSpace: 'nowrap',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.slice(0, 15).map(([custId, date, amount, currency, category], i) => (
                                <tr
                                    key={i}
                                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)'}
                                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                                >
                                    <td style={{ padding: '0.5rem 0.875rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{i + 1}</td>
                                    <td style={{ padding: '0.5rem 0.875rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{custId}</td>
                                    <td style={{ padding: '0.5rem 0.875rem', color: 'var(--text-secondary)' }}>{date}</td>
                                    <td style={{ padding: '0.5rem 0.875rem', color: 'var(--accent-primary)', fontWeight: 500 }}>{fmt.format(amount)}</td>
                                    <td style={{ padding: '0.5rem 0.875rem', color: 'var(--text-muted)' }}>{currency}</td>
                                    <td style={{ padding: '0.5rem 0.875rem', color: 'var(--text-muted)' }}>{category || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {rows.length > 15 && (
                    <p className="text-muted" style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '-0.75rem' }}>
                        Showing 15 of {rows.length} sample rows
                    </p>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
                    <button id="import-cancel-btn" onClick={onClose} style={primaryBtnStyle('rgba(255,255,255,0.06)', 'var(--text-secondary)')}>
                        Cancel
                    </button>
                    <button id="import-confirm-btn" onClick={onCommit} style={primaryBtnStyle('var(--accent-primary)', '#000')}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Import {result.total_rows.toLocaleString()} rows
                    </button>
                </div>
            </div>
        );
    }

    return null;
};

function primaryBtnStyle(bg: string, color: string): React.CSSProperties {
    return {
        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        padding: '0.5rem 1.25rem', borderRadius: '0.5rem',
        background: bg, color, border: 'none', cursor: 'pointer',
        fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
        transition: 'opacity var(--transition-fast)',
    };
}

import React, { useState, useEffect, useCallback } from 'react';
import {
    listMrrLog,
    countMrrLog,
    addMrrLog,
    requestDeleteMrrLog,
    confirmDeleteMrrLog,
    MrrLogRow,
    MrrLogAddPayload,
} from '../../lib/ipc/data';
import { useFinancialsStore } from '../../store/financials';
import { useWorkspaceStore } from '../../store/workspace';
import { ImportButton } from '../import/ImportButton';
import { ExportButton } from '../export/ExportButton';
import { InlineConfirm } from '../../components/InlineConfirm';
import { ErrorBanner } from '../../components/ErrorBanner';
import { mapBackendError } from '../../utils/errors';
import { validateMrrAmount } from '../../utils/math';

const PAGE_SIZE = 50;

export const DataManagementView: React.FC = () => {
    const [rows, setRows] = useState<MrrLogRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('period');
    const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Delete row state
    const [deletingRow, setDeletingRow] = useState<{ rowid: number; token: string } | null>(null);


    // Add row form
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        customer_id: '',
        period: new Date().toISOString().slice(0, 10),
        mrr_amount: '0',
        currency: 'USD',
        category: 'Standard',
    });
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const fetchData = useFinancialsStore(s => s.fetchData);
    const activeWorkspaceId = useWorkspaceStore(s => s.activeId);
    const hasWorkspace = Boolean(activeWorkspaceId);

    const loadRows = useCallback(async (p: number, q: string, sb: string, sd: string) => {
        if (!hasWorkspace) {
            setRows([]);
            setTotal(0);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const [data, count] = await Promise.all([
                listMrrLog(q, sb, sd, p * PAGE_SIZE, PAGE_SIZE),
                countMrrLog(q),
            ]);
            setRows(data);
            setTotal(count);
        } catch (e: unknown) {
            setError((e as Error)?.message ?? String(e));
        } finally {
            setIsLoading(false);
        }
    }, [activeWorkspaceId, hasWorkspace]);

    const refreshRows = useCallback(async (nextPage = page) => {
        await loadRows(nextPage, search, sortBy, sortDir);
    }, [loadRows, page, search, sortBy, sortDir]);

    useEffect(() => {
        loadRows(page, search, sortBy, sortDir);
    }, [page, search, sortBy, sortDir, loadRows]);

    const handleSort = (col: string) => {
        if (sortBy === col) {
            setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setSortBy(col);
            setSortDir('DESC');
        }
        setPage(0);
    };

    const handleRequestDelete = async (row: MrrLogRow) => {
        if (!activeWorkspaceId) return;
        try {
            const token = await requestDeleteMrrLog(row.rowid);
            setDeletingRow({ rowid: row.rowid, token });
        } catch (e: any) {
            setError(e instanceof Error ? e.message : (typeof e === 'string' ? e : (JSON.stringify(e) || String(e))));
        }
    };

    const handleConfirmDelete = async () => {
        if (!activeWorkspaceId || !deletingRow) return;

        try {
            await confirmDeleteMrrLog(deletingRow.rowid, deletingRow.token);
            setDeletingRow(null);
            await refreshRows(page);
            await fetchData();
        } catch (e: any) {
            setError(e instanceof Error ? e.message : (typeof e === 'string' ? e : (JSON.stringify(e) || String(e))));
            setDeletingRow(null);
        }
    };

    // Undo logic removed for 2-step strict delete

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeWorkspaceId) return;

        setSubmitting(true);
        setFormError(null);
        try {
            const parsedAmount = validateMrrAmount(formData.mrr_amount);
            const payload: MrrLogAddPayload = {
                ...formData,
                mrr_amount: parsedAmount,
            };
            await addMrrLog(payload);
            setShowAddForm(false);
            setFormData({ customer_id: '', period: new Date().toISOString().slice(0, 10), mrr_amount: '0', currency: 'USD', category: 'Standard' });
            setPage(0);
            await refreshRows(0);
            await fetchData();
        } catch (e: any) {
            setFormError(e instanceof Error ? e.message : (typeof e === 'string' ? e : (JSON.stringify(e) || String(e))));
        } finally {
            setSubmitting(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));


    const SortArrow = ({ col }: { col: string }) => (
        <span style={{ marginLeft: 4, opacity: sortBy === col ? 1 : 0.3, fontSize: '0.75rem' }}>
            {sortBy === col ? (sortDir === 'ASC' ? '▲' : '▼') : '▼'}
        </span>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header className="mb-2">
                <h2 className="page-title">Data Management</h2>
                <p className="page-subtitle">Search, edit and manage your MRR records.</p>
            </header>

            {/* Toolbar */}
            <div className="flex-between" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                <input
                    type="text"
                    placeholder="Search by customer or currency…"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0); }}
                    style={{
                        flex: 1, minWidth: 200, maxWidth: 400,
                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)',
                        borderRadius: '0.5rem', padding: '0.5rem 0.75rem', color: 'var(--text-primary)', fontSize: '0.875rem'
                    }}
                />
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <ImportButton />
                    <ExportButton />
                    <button
                        className="nav-item active"
                        onClick={() => setShowAddForm(v => !v)}
                        style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem' }}
                    >
                        + Add Row
                    </button>
                </div>
            </div>

            {/* Add Row Form */}
            {showAddForm && (
                <div className="glass-panel p-6" style={{ borderColor: 'var(--accent-primary)' }}>
                    <h3 className="card-title" style={{ marginBottom: '1rem' }}>Add MRR Record</h3>
                    {formError && mapBackendError(formError) && (
                        <ErrorBanner error={mapBackendError(formError)} onClear={() => setFormError(null)} />
                    )}
                    <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: '0.75rem', alignItems: 'end' }}>
                        {[
                            { label: 'Customer ID', key: 'customer_id', type: 'text', placeholder: 'acme-corp' },
                            { label: 'Period (YYYY-MM-DD)', key: 'period', type: 'date', placeholder: '' },
                            { label: 'MRR Amount', key: 'mrr_amount', type: 'number', placeholder: '0.00' },
                            { label: 'Currency', key: 'currency', type: 'text', placeholder: 'USD' },
                            { label: 'Category', key: 'category', type: 'text', placeholder: 'Standard' },
                        ].map(({ label, key, type, placeholder }) => (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                                <input
                                    type={type}
                                    placeholder={placeholder}
                                    step={type === 'number' ? '0.01' : undefined}
                                    min={type === 'number' ? '0' : undefined}
                                    max={type === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
                                    value={(formData as any)[key]}
                                    onChange={e => setFormData(prev => ({
                                        ...prev,
                                        [key]: e.target.value,
                                    }))}
                                    required
                                    style={{
                                        background: 'rgba(255,255,255,0.07)', border: '1px solid var(--border-color)',
                                        borderRadius: '0.375rem', padding: '0.5rem 0.625rem', color: 'var(--text-primary)', fontSize: '0.875rem'
                                    }}
                                />
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: '0.5rem', gridColumn: '1 / -1', justifyContent: 'flex-end' }}>
                            <button type="button" onClick={() => setShowAddForm(false)} className="nav-item" style={{ padding: '0.5rem 1rem', borderRadius: '0.375rem' }}>
                                Cancel
                            </button>
                            <button type="submit" disabled={submitting} className="nav-item active" style={{ padding: '0.5rem 1.25rem', borderRadius: '0.375rem' }}>
                                {submitting ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Undo toast removed for strict 2-step delete */}

            {/* Error */}
            {error && mapBackendError(error) && (
                <ErrorBanner error={mapBackendError(error)} onClear={() => setError(null)} />
            )}

            {/* Table */}
            <div className="glass-panel" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                            {[
                                { label: 'Customer ID', col: 'customer_id' },
                                { label: 'Period', col: 'period' },
                                { label: 'MRR Amount', col: 'mrr_amount' },
                                { label: 'Currency', col: 'currency' },
                                { label: 'Category', col: 'category' },
                            ].map(({ label, col }) => (
                                <th
                                    key={col}
                                    onClick={() => handleSort(col)}
                                    style={{ textAlign: 'left', padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 500, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                >
                                    {label}<SortArrow col={col} />
                                </th>
                            ))}
                            <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading…</td></tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                                    <div style={{ marginBottom: '1rem' }}>
                                        No records found{search ? ' matching your search' : '. Import CSV or Excel data to get started.'}
                                    </div>
                                </td>
                            </tr>
                        ) : rows.map(row => (
                            <tr
                                key={row.rowid}
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.15s' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                            >
                                <td style={{ padding: '0.625rem 1rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{row.customer_id}</td>
                                <td style={{ padding: '0.625rem 1rem', color: 'var(--text-secondary)' }}>{row.period}</td>
                                <td style={{ padding: '0.625rem 1rem', color: 'var(--accent-primary)', fontWeight: 500 }}>
                                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: row.currency, maximumFractionDigits: 2 }).format(row.mrr_amount)}
                                </td>
                                <td style={{ padding: '0.625rem 1rem', color: 'var(--text-muted)' }}>{row.currency}</td>
                                <td style={{ padding: '0.625rem 1rem', color: 'var(--text-muted)' }}>{row.category || '—'}</td>
                                <td style={{ padding: '0.625rem 1rem', textAlign: 'right' }}>
                                    {deletingRow?.rowid === row.rowid ? (
                                        <InlineConfirm
                                            message="Delete?"
                                            confirmText="Confirm"
                                            cancelText="Cancel"
                                            onConfirm={handleConfirmDelete}
                                            onCancel={() => {
                                                // Cancel discards the state. The requested token is not 
                                                // explicitly released; it will simply expire via its 5-minute TTL.
                                                // This is an intentional security design (fail-closed).
                                                setDeletingRow(null);
                                            }}
                                        />
                                    ) : (
                                        <button
                                            onClick={() => handleRequestDelete(row)}
                                            title="Delete row"
                                            style={{
                                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                                                color: 'var(--status-danger)', borderRadius: '0.375rem', padding: '0.25rem 0.625rem',
                                                cursor: 'pointer', fontSize: '0.75rem', transition: 'background 0.15s'
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                                        >
                                            Delete
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex-between" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                <span>{total.toLocaleString()} total records</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button className="nav-item" disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ padding: '0.25rem 0.75rem', borderRadius: '0.375rem', opacity: page === 0 ? 0.4 : 1 }}>
                        ←
                    </button>
                    <span>Page {page + 1} of {totalPages}</span>
                    <button className="nav-item" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ padding: '0.25rem 0.75rem', borderRadius: '0.375rem', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
                        →
                    </button>
                </div>
            </div>
        </div>
    );
};

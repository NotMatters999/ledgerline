import React, { useState, useEffect } from 'react';
import { listBackups, createBackup, requestRestore, confirmRestore } from '../../lib/ipc/backup';
import { getSetting, setSetting } from '../../lib/ipc/settings';

type ActiveTab = 'backups' | 'preferences';

export const SettingsView: React.FC<{ activeWorkspaceId: string }> = ({ activeWorkspaceId }) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('backups');

    // ── Backup state ───────────────────────────────────────────────────────────
    const [backups, setBackups] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [pendingRestore, setPendingRestore] = useState<{ filename: string; token: string } | null>(null);

    // ── Preferences state ──────────────────────────────────────────────────────
    const [grossMargin, setGrossMargin] = useState('100');
    const [fxRate, setFxRate] = useState('1.00');
    const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
    const [prefSaved, setPrefSaved] = useState(false);
    const [prefError, setPrefError] = useState<string | null>(null);

    const fetchBackups = async () => {
        try {
            setLoading(true);
            setBackups(await listBackups(activeWorkspaceId));
        } catch (err: unknown) {
            setActionError(String(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBackups();
        Promise.allSettled([
            getSetting(activeWorkspaceId, 'gross_margin'),
            getSetting(activeWorkspaceId, 'fx_rate'),
            getSetting(activeWorkspaceId, 'date_format'),
        ]).then(([gm, fx, df]) => {
            if (gm.status === 'fulfilled') setGrossMargin((parseFloat(gm.value) * 100).toFixed(0));
            if (fx.status === 'fulfilled') setFxRate(fx.value);
            if (df.status === 'fulfilled') setDateFormat(df.value);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWorkspaceId]);

    const handleCreateBackup = async () => {
        try {
            setActionError(null);
            setActionSuccess(null);
            const filename = await createBackup(activeWorkspaceId);
            setActionSuccess(`Backup created: ${filename}`);
            fetchBackups();
        } catch (err: any) {
            setActionError(err.toString());
        }
    };

    const handleRestoreRequest = async (filename: string) => {
        try {
            setActionError(null);
            setActionSuccess(null);
            setPendingRestore({ filename, token: await requestRestore(filename) });
        } catch (err: any) {
            setActionError(err.toString());
        }
    };

    const handleRestoreConfirm = async () => {
        if (!pendingRestore) return;
        try {
            setActionError(null);
            await confirmRestore(activeWorkspaceId, pendingRestore.filename, pendingRestore.token);
            setActionSuccess(`Restored from ${pendingRestore.filename}. Reload the app to see changes.`);
            setPendingRestore(null);
        } catch (err: any) {
            setActionError(err.toString());
            setPendingRestore(null);
        }
    };

    const handleSavePreferences = async () => {
        setPrefError(null);
        setPrefSaved(false);
        try {
            const gm = parseFloat(grossMargin);
            if (isNaN(gm) || gm < 0 || gm > 100) throw new Error('Gross margin must be 0–100');
            const fx = parseFloat(fxRate);
            if (isNaN(fx) || fx <= 0) throw new Error('FX rate must be a positive number');
            if (!dateFormat.trim()) throw new Error('Date format cannot be empty');

            await Promise.all([
                setSetting(activeWorkspaceId, 'gross_margin', (gm / 100).toString()),
                setSetting(activeWorkspaceId, 'fx_rate', fx.toString()),
                setSetting(activeWorkspaceId, 'date_format', dateFormat.trim()),
            ]);
            setPrefSaved(true);
            setTimeout(() => setPrefSaved(false), 3000);
        } catch (e: any) {
            setPrefError(e?.message ?? e?.toString());
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '860px', margin: '0 auto' }}>
            <header className="mb-2" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <h2 className="page-title">Settings & Backups</h2>
                <p className="page-subtitle" style={{ marginBottom: 0 }}>Manage financial assumptions, currency preferences, and database snapshots.</p>
            </header>

            {/* Tab Bar */}
            <div className="nav-menu" style={{ alignSelf: 'flex-start' }}>
                <button className={`nav-item ${activeTab === 'backups' ? 'active' : ''}`} onClick={() => setActiveTab('backups')}>
                    Backups
                </button>
                <button className={`nav-item ${activeTab === 'preferences' ? 'active' : ''}`} onClick={() => setActiveTab('preferences')}>
                    Preferences
                </button>
            </div>

            {/* ── Backups Tab ──────────────────────────────────────────────────── */}
            {activeTab === 'backups' && (
                <>
                    {actionError && (
                        <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--status-danger)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {actionError}
                        </div>
                    )}
                    {actionSuccess && (
                        <div style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--status-success)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(16,185,129,0.2)' }}>
                            {actionSuccess}
                        </div>
                    )}

                    <div className="glass-panel p-6" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                            <div>
                                <h3 className="card-title" style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Database Backups</h3>
                                <p className="text-muted" style={{ fontSize: '0.875rem' }}>Snapshots are taken automatically before every import. Last 5 backups are kept.</p>
                            </div>
                            <button onClick={handleCreateBackup} className="btn-primary">Create Backup</button>
                        </div>

                        {loading ? (
                            <div className="text-muted" style={{ padding: '0.5rem 0' }}>Loading backups…</div>
                        ) : backups.length === 0 ? (
                            <div className="text-muted" style={{ padding: '0.5rem 0', fontStyle: 'italic' }}>No backups yet.</div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {backups.map(b => (
                                    <div key={b} className="flex-between" style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
                                        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{b}</span>
                                        {pendingRestore?.filename === b ? (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={handleRestoreConfirm} className="btn-primary" style={{ background: 'linear-gradient(135deg,#EF4444,#DC2626)' }}>
                                                    Confirm Overwrite
                                                </button>
                                                <button onClick={() => setPendingRestore(null)} className="btn-secondary">Cancel</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => handleRestoreRequest(b)} disabled={pendingRestore !== null} className="btn-secondary">
                                                Restore
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ── Preferences Tab ──────────────────────────────────────────────── */}
            {activeTab === 'preferences' && (
                <div className="glass-panel p-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <h3 className="card-title" style={{ color: 'var(--text-primary)' }}>Financial Assumptions</h3>

                    {[
                        {
                            label: 'Gross Margin (%)',
                            hint: 'Used to calculate LTV and Payback Period. Enter 0–100.',
                            value: grossMargin,
                            setter: setGrossMargin,
                            type: 'number',
                            inputProps: { min: '0', max: '100', step: '1' },
                        },
                        {
                            label: 'FX Rate (to USD)',
                            hint: 'Multiply all MRR figures by this factor for USD-normalised reporting. Default: 1.00',
                            value: fxRate,
                            setter: setFxRate,
                            type: 'number',
                            inputProps: { min: '0.0001', step: '0.01' },
                        },
                        {
                            label: 'Date Format',
                            hint: 'Display format used in exports and labels. E.g. YYYY-MM-DD or MM/DD/YYYY.',
                            value: dateFormat,
                            setter: setDateFormat,
                            type: 'text',
                            inputProps: { placeholder: 'YYYY-MM-DD' },
                        },
                    ].map(({ label, hint, value, setter, type, inputProps }) => (
                        <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                            <label style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>{label}</label>
                            <input
                                type={type}
                                value={value}
                                onChange={e => setter(e.target.value)}
                                className="input-field"
                                style={{ maxWidth: 240 }}
                                {...inputProps}
                            />
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{hint}</p>
                        </div>
                    ))}

                    {prefError && <p style={{ color: 'var(--status-danger)', fontSize: '0.875rem' }}>{prefError}</p>}
                    {prefSaved && <p style={{ color: 'var(--status-success)', fontSize: '0.875rem' }}>✓ Preferences saved</p>}

                    <button onClick={handleSavePreferences} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                        Save Preferences
                    </button>
                </div>
            )}
        </div>
    );
};

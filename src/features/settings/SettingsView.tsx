import React, { useState, useEffect, useRef, useCallback } from 'react';
import { listBackups, createBackup, requestRestore, confirmRestore } from '../../lib/ipc/backup';
import { getSetting, setSetting, getExchangeRates, setExchangeRates, getCurrenciesMissingRates } from '../../lib/ipc/settings';
import type { ExchangeRate } from '../../lib/ipc/settings';
import { percentToDecimal, decimalToPercent } from '../../utils/math';
import { ErrorBanner } from '../../components/ErrorBanner';
import { mapBackendError } from '../../utils/errors';

import { useWorkspaceStore } from '../../store/workspace';

type ActiveTab = 'backups' | 'preferences';

export const SettingsView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('backups');

    // ── Backup state ───────────────────────────────────────────────────────────
    const [backups, setBackups] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    const [pendingRestore, setPendingRestore] = useState<{ filename: string; token: string } | null>(null);

    // ── Preferences state ──────────────────────────────────────────────────────
    const [grossMargin, setGrossMargin] = useState('100');
    const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
    const [prefSaved, setPrefSaved] = useState(false);
    const [prefError, setPrefError] = useState<string | null>(null);
    const prefSaveTimer = useRef<number | null>(null);

    // ── Currency rates state ───────────────────────────────────────────────────
    // `rateInputs` is keyed by currency code. We union discovered + saved currencies.
    const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
    const [ratesSaved, setRatesSaved] = useState(false);
    const [ratesError, setRatesError] = useState<string | null>(null);
    const ratesTimer = useRef<number | null>(null);

    const activeWorkspaceId = useWorkspaceStore(s => s.activeId);

    const fetchBackups = useCallback(async () => {
        if (!activeWorkspaceId) {
            setBackups([]);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setBackups(await listBackups());
        } catch (err: unknown) {
            setActionError(String(err));
        } finally {
            setLoading(false);
        }
    }, [activeWorkspaceId]);

    const loadPreferences = useCallback(async () => {
        const [gm, df] = await Promise.allSettled([
            getSetting('gross_margin'),
            getSetting('date_format'),
        ]);

        if (gm.status === 'fulfilled') {
            const parsed = parseFloat(gm.value);
            setGrossMargin(decimalToPercent(parsed));
        }
        if (df.status === 'fulfilled') setDateFormat(df.value);
    }, [activeWorkspaceId]);

    const loadCurrencyRates = useCallback(async () => {
        try {
            // Fetch saved rates + currencies that have no rate yet
            const [saved, missing] = await Promise.all([
                getExchangeRates(),
                getCurrenciesMissingRates(),
            ]);

            const inputs: Record<string, string> = {};
            // Pre-fill saved rates
            for (const r of saved) {
                inputs[r.currency] = r.rate_to_base.toString();
            }
            // Add discovered currencies that have no rate (blank inputs)
            for (const c of missing) {
                if (!(c in inputs)) inputs[c] = '';
            }
            setRateInputs(inputs);
        } catch {
            // Not a critical failure — just show empty state
        }
    }, [activeWorkspaceId]);

    useEffect(() => {
        fetchBackups();
        loadPreferences();
        loadCurrencyRates();

        return () => {
            if (prefSaveTimer.current) window.clearTimeout(prefSaveTimer.current);
            if (ratesTimer.current) window.clearTimeout(ratesTimer.current);
        };
    }, [fetchBackups, loadPreferences, loadCurrencyRates]);

    const handleCreateBackup = async () => {
        try {
            setActionError(null);
            setActionSuccess(null);
            const filename = await createBackup();
            setActionSuccess(`Backup created: ${filename}`);
            fetchBackups();
        } catch (err: any) {
            setActionError(err.toString());
        }
    };

    const handleRestoreRequest = async (filename: string) => {
        if (!activeWorkspaceId) return;
        try {
            setActionError(null);
            setActionSuccess(null);
            const token = await requestRestore(filename);
            setPendingRestore({ filename, token });
        } catch (err: any) {
            setActionError(err.toString());
        }
    };

    const handleRestoreConfirm = async () => {
        if (!pendingRestore) return;
        try {
            setActionError(null);
            await confirmRestore(pendingRestore.filename, pendingRestore.token);
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
            if (!dateFormat.trim()) throw new Error('Date format cannot be empty');

            await Promise.all([
                setSetting('gross_margin', percentToDecimal(gm).toString()),
                setSetting('date_format', dateFormat.trim()),
            ]);
            setPrefSaved(true);
            if (prefSaveTimer.current) window.clearTimeout(prefSaveTimer.current);
            prefSaveTimer.current = window.setTimeout(() => setPrefSaved(false), 3000);
        } catch (e: any) {
            setPrefError(e?.message ?? e?.toString());
        }
    };

    const handleSaveRates = async () => {
        setRatesError(null);
        setRatesSaved(false);
        try {
            const rates: ExchangeRate[] = [];
            for (const [currency, raw] of Object.entries(rateInputs)) {
                const trimmed = raw.trim();
                if (!trimmed) continue; // skip blank — don't overwrite existing with nothing
                const val = parseFloat(trimmed);
                if (isNaN(val) || val <= 0) {
                    throw new Error(`Rate for ${currency} must be a positive number`);
                }
                rates.push({ currency, rate_to_base: val });
            }
            if (rates.length === 0) {
                setRatesError('Enter at least one rate to save.');
                return;
            }
            await setExchangeRates(rates);
            setRatesSaved(true);
            // Reload to reflect any backend normalisation
            await loadCurrencyRates();
            if (ratesTimer.current) window.clearTimeout(ratesTimer.current);
            ratesTimer.current = window.setTimeout(() => setRatesSaved(false), 3000);
        } catch (e: any) {
            setRatesError(e?.message ?? e?.toString());
        }
    };

    const currencies = Object.keys(rateInputs).sort();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '860px', margin: '0 auto' }}>
            <header className="mb-2" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <h2 className="page-title">Settings &amp; Backups</h2>
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
                        <ErrorBanner
                            error={mapBackendError(actionError) ?? actionError}
                            onClear={() => setActionError(null)}
                        />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Financial Assumptions */}
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

                        {prefError && (
                            <ErrorBanner
                                error={mapBackendError(prefError) ?? prefError}
                                onClear={() => setPrefError(null)}
                            />
                        )}
                        {prefSaved && <p style={{ color: 'var(--status-success)', fontSize: '0.875rem' }}>✓ Preferences saved</p>}

                        <button onClick={handleSavePreferences} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                            Save Preferences
                        </button>
                    </div>

                    {/* Currency Rates */}
                    <div className="glass-panel p-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <h3 className="card-title" style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Currency Rates</h3>
                            <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                                Set the exchange rate for each currency relative to your base/reporting currency.
                                The base currency itself should have rate&nbsp;<code>1.0</code>.
                                Currencies without a rate are treated as 1:1.
                            </p>
                        </div>

                        {currencies.length === 0 ? (
                            <p className="text-muted" style={{ fontStyle: 'italic', fontSize: '0.875rem' }}>
                                No currencies detected yet. Import data first to populate this section.
                            </p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                {currencies.map(currency => (
                                    <div key={currency} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <label style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                            {currency}
                                        </label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 1.27"
                                            min="0.0001"
                                            step="0.0001"
                                            value={rateInputs[currency] ?? ''}
                                            onChange={e => setRateInputs(prev => ({ ...prev, [currency]: e.target.value }))}
                                            className="input-field"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}

                        {ratesError && (
                            <ErrorBanner
                                error={ratesError}
                                onClear={() => setRatesError(null)}
                            />
                        )}
                        {ratesSaved && <p style={{ color: 'var(--status-success)', fontSize: '0.875rem' }}>✓ Exchange rates saved</p>}

                        {currencies.length > 0 && (
                            <button onClick={handleSaveRates} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                                Save Currency Rates
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

import React, { useState, useEffect } from 'react';
import { listBackups, createBackup, requestRestore, confirmRestore } from '../../lib/ipc/backup';

export const SettingsView: React.FC = () => {
    const [backups, setBackups] = useState<string[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);
    
    // Restore confirm state
    const [pendingRestore, setPendingRestore] = useState<{ filename: string, token: string } | null>(null);

    const fetchBackups = async () => {
        try {
            setLoading(true);
            const list = await listBackups('default');
            setBackups(list);
        } catch (err: any) {
            setActionError(err.toString());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBackups();
    }, []);

    const handleCreateBackup = async () => {
        try {
            setActionError(null);
            setActionSuccess(null);
            const filename = await createBackup('default');
            setActionSuccess(`Successfully created backup: ${filename}`);
            fetchBackups();
        } catch (err: any) {
            setActionError(err.toString());
        }
    };

    const handleRestoreRequest = async (filename: string) => {
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
            await confirmRestore('default', pendingRestore.filename, pendingRestore.token);
            setActionSuccess(`Successfully restored database from ${pendingRestore.filename}. Please restart the application or refresh the page.`);
            setPendingRestore(null);
        } catch (err: any) {
            setActionError(err.toString());
            setPendingRestore(null);
        }
    };

    const handleRestoreCancel = () => {
        setPendingRestore(null);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', minHeight: '600px', maxWidth: '896px', margin: '0 auto' }}>
            <header className="mb-2" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <h2 className="page-title">Settings & Backups</h2>
                <p className="page-subtitle" style={{ marginBottom: 0 }}>Manage application settings and database snapshots.</p>
            </header>

            {actionError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    {actionError}
                </div>
            )}
            {actionSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-success)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                    {actionSuccess}
                </div>
            )}

            {/* Backup Management Section */}
            <div className="glass-panel p-6" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="flex-between" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                    <div>
                        <h3 className="card-title" style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Database Backups</h3>
                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>Automated snapshots are taken before every import. Retention is limited to the last 5 backups.</p>
                    </div>
                    <button 
                        onClick={handleCreateBackup}
                        className="btn-primary"
                    >
                        Create Manual Backup
                    </button>
                </div>

                {loading ? (
                    <div className="text-muted" style={{ padding: '1rem 0' }}>Loading backups...</div>
                ) : backups.length === 0 ? (
                    <div className="text-muted" style={{ padding: '1rem 0', fontStyle: 'italic' }}>No backups found.</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {backups.map(b => (
                            <div key={b} className="flex-between" style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }}>
                                <span className="text-muted" style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{b}</span>
                                {pendingRestore?.filename === b ? (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button 
                                            onClick={handleRestoreConfirm}
                                            className="btn-primary"
                                            style={{ background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)' }}
                                        >
                                            Confirm Overwrite
                                        </button>
                                        <button 
                                            onClick={handleRestoreCancel}
                                            className="btn-secondary"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => handleRestoreRequest(b)}
                                        disabled={pendingRestore !== null}
                                        className="btn-secondary"
                                    >
                                        Restore
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

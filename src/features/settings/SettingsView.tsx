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
        <div className="w-full flex flex-col gap-6 h-full min-h-[600px] max-w-4xl mx-auto">
            <header className="mb-2 border-b border-white/10 pb-4">
                <h2 className="text-2xl font-bold tracking-tight text-white">Settings & Backups</h2>
                <p className="text-gray-400 mt-1">Manage application settings and database snapshots.</p>
            </header>

            {actionError && (
                <div className="bg-rose-500/10 text-rose-400 p-4 rounded-xl border border-rose-500/20 shadow-lg">
                    {actionError}
                </div>
            )}
            {actionSuccess && (
                <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-xl border border-emerald-500/20 shadow-lg">
                    {actionSuccess}
                </div>
            )}

            {/* Backup Management Section */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white">Database Backups</h3>
                        <p className="text-sm text-gray-400">Automated snapshots are taken before every import. Retention is limited to the last 5 backups.</p>
                    </div>
                    <button 
                        onClick={handleCreateBackup}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors shadow-md"
                    >
                        Create Manual Backup
                    </button>
                </div>

                {loading ? (
                    <div className="text-gray-400 py-4">Loading backups...</div>
                ) : backups.length === 0 ? (
                    <div className="text-gray-400 py-4 italic">No backups found.</div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {backups.map(b => (
                            <div key={b} className="flex justify-between items-center p-3 rounded-lg bg-gray-900 border border-gray-800">
                                <span className="font-mono text-sm text-gray-300">{b}</span>
                                {pendingRestore?.filename === b ? (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={handleRestoreConfirm}
                                            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded shadow transition-colors"
                                        >
                                            Confirm Overwrite
                                        </button>
                                        <button 
                                            onClick={handleRestoreCancel}
                                            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => handleRestoreRequest(b)}
                                        disabled={pendingRestore !== null}
                                        className="px-3 py-1 bg-amber-600/20 text-amber-500 hover:bg-amber-600 hover:text-white border border-amber-600/30 text-xs font-medium rounded transition-all disabled:opacity-50"
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

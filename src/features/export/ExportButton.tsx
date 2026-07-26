import React, { useState } from 'react';
import { exportCsv, exportPdf, downloadBlob } from '../../lib/ipc/export';

interface Props {
    activeWorkspaceId: string;
}

export const ExportButton: React.FC<Props> = ({ activeWorkspaceId }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showMenu, setShowMenu] = useState(false);

    const handleCsvExport = async () => {
        setIsExporting(true);
        setError(null);
        try {
            const data = await exportCsv(activeWorkspaceId);
            // Download as 3 separate files or just combine them?
            // A combined CSV with clear section headers is usually easiest for a single download
            const combined = `--- MRR LOG ---\n${data.mrr_csv}\n\n--- RETENTION LOG ---\n${data.retention_csv}\n\n--- COHORTS LOG ---\n${data.cohorts_csv}`;
            downloadBlob(combined, 'ledgerline_data.csv', 'text/csv');
        } catch (err: any) {
            setError(`CSV Export failed: ${err.toString()}`);
        } finally {
            setIsExporting(false);
            setShowMenu(false);
        }
    };

    const handlePdfExport = async () => {
        setIsExporting(true);
        setError(null);
        try {
            const data = await exportPdf(activeWorkspaceId);
            // Convert Array of numbers to Uint8Array for Blob
            const u8 = new Uint8Array(data);
            downloadBlob(u8, 'ledgerline_report.pdf', 'application/pdf');
        } catch (err: any) {
            setError(`PDF Export failed: ${err.toString()}`);
        } finally {
            setIsExporting(false);
            setShowMenu(false);
        }
    };

    return (
        <div style={{ position: 'relative' }} className="export-dropdown-container">
            <button 
                className="btn-primary"
                disabled={!activeWorkspaceId || isExporting}
                style={{ padding: '0.375rem 1rem' }}
                onClick={() => setShowMenu((value) => !value)}
            >
                {isExporting ? 'Exporting...' : 'Export Data'}
            </button>
            
            {showMenu && (
                <div 
                    className="export-dropdown"
                    style={{
                        position: 'absolute', right: 0, marginTop: '0.5rem', width: '12rem',
                        background: 'rgba(21, 26, 35, 0.95)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid var(--border-color)', borderRadius: '0.5rem',
                        boxShadow: 'var(--shadow-lg)', zIndex: 50, display: 'flex', flexDirection: 'column'
                    }}
                >
                <button 
                    onClick={handleCsvExport}
                    disabled={!activeWorkspaceId || isExporting}
                    style={{
                        width: '100%', textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.875rem',
                        color: 'var(--text-primary)', background: 'transparent', border: 'none',
                        borderTopLeftRadius: '0.5rem', borderTopRightRadius: '0.5rem', cursor: 'pointer',
                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                    }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'transparent'; }}
                >
                    Export as CSV
                </button>
                <button 
                    onClick={handlePdfExport}
                    disabled={!activeWorkspaceId || isExporting}
                    style={{
                        width: '100%', textAlign: 'left', padding: '0.75rem 1rem', fontSize: '0.875rem',
                        color: 'var(--text-primary)', background: 'transparent', border: 'none',
                        borderBottomLeftRadius: '0.5rem', borderBottomRightRadius: '0.5rem', cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'transparent'; }}
                >
                    Export as PDF
                </button>
            </div>
            )}

            {error && (
                <div style={{
                    position: 'absolute', right: 0, marginTop: '3rem', width: '16rem',
                    background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)', padding: '0.5rem',
                    borderRadius: '0.25rem', border: '1px solid rgba(239, 68, 68, 0.2)',
                    fontSize: '0.75rem', boxShadow: 'var(--shadow-lg)', zIndex: 50
                }}>
                    {error}
                </div>
            )}
        </div>
    );
};

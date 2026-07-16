import React, { useState } from 'react';
import { exportCsv, exportPdf, downloadBlob } from '../../lib/ipc/export';

export const ExportButton: React.FC = () => {
    const [isExporting, setIsExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCsvExport = async () => {
        setIsExporting(true);
        setError(null);
        try {
            const data = await exportCsv('default');
            // Download as 3 separate files or just combine them?
            // A combined CSV with clear section headers is usually easiest for a single download
            const combined = `--- MRR LOG ---\n${data.mrr_csv}\n\n--- RETENTION LOG ---\n${data.retention_csv}\n\n--- COHORTS LOG ---\n${data.cohorts_csv}`;
            downloadBlob(combined, 'ledgerline_data.csv', 'text/csv');
        } catch (err: any) {
            setError(`CSV Export failed: ${err.toString()}`);
        } finally {
            setIsExporting(false);
        }
    };

    const handlePdfExport = async () => {
        setIsExporting(true);
        setError(null);
        try {
            const data = await exportPdf('default');
            // Convert Array of numbers to Uint8Array for Blob
            const u8 = new Uint8Array(data);
            downloadBlob(u8, 'ledgerline_report.pdf', 'application/pdf');
        } catch (err: any) {
            setError(`PDF Export failed: ${err.toString()}`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="relative group">
            <button 
                className="px-4 py-1.5 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all duration-200 flex items-center gap-2"
                disabled={isExporting}
            >
                {isExporting ? 'Exporting...' : 'Export Data'}
            </button>
            
            {/* Dropdown Menu (visible on hover) */}
            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <button 
                    onClick={handleCsvExport}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white first:rounded-t-md"
                >
                    Export as CSV
                </button>
                <button 
                    onClick={handlePdfExport}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white last:rounded-b-md"
                >
                    Export as PDF
                </button>
            </div>

            {error && (
                <div className="absolute right-0 mt-12 w-64 bg-rose-500/10 text-rose-400 p-2 rounded border border-rose-500/20 text-xs shadow-xl z-50">
                    {error}
                </div>
            )}
        </div>
    );
};

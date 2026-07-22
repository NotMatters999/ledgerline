import React, { useEffect, useState } from 'react';
import { useFinancialsStore } from '../../store/financials';
import { WaterfallChart } from '../../charts/WaterfallChart';

export const WaterfallView: React.FC = () => {
    const { mrr, isLoading, error, fetchData } = useFinancialsStore();
    const [selectedMonth, setSelectedMonth] = useState<string>('');

    useEffect(() => {
        if (mrr.length === 0) {
            fetchData('default');
        }
    }, [mrr.length, fetchData]);

    useEffect(() => {
        if (mrr.length > 0 && !selectedMonth) {
            setSelectedMonth(mrr[mrr.length - 1].month);
        }
    }, [mrr, selectedMonth]);

    if (isLoading && mrr.length === 0) {
        return (
            <div className="flex-center" style={{ height: '100%', color: 'var(--text-primary)' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (error && mrr.length === 0) {
        return (
            <div className="flex-center" style={{ height: '100%', padding: '2rem' }}>
                <div className="glass-panel p-6" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <h2 className="page-title" style={{ fontSize: '1.25rem', color: 'var(--status-danger)' }}>Error Loading Waterfall</h2>
                    <p className="text-muted" style={{ marginTop: '0.5rem' }}>{error}</p>
                </div>
            </div>
        );
    }

    const data = mrr.find(m => m.month === selectedMonth);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header className="mb-2 flex-between" style={{ alignItems: 'flex-end' }}>
                <div>
                    <h2 className="page-title">MRR Waterfall</h2>
                    <p className="page-subtitle" style={{ marginBottom: 0 }}>A detailed bridge from Beginning MRR to Ending MRR.</p>
                </div>
                {mrr.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <label className="text-muted" style={{ fontSize: '0.875rem' }}>Select Month</label>
                        <select 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="input-field"
                        >
                            {[...mrr].reverse().map(m => (
                                <option key={m.month} value={m.month}>
                                    {m.month.substring(0, 7)}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </header>

            <div style={{ width: '100%' }}>
                {data ? (
                    <WaterfallChart data={data} />
                ) : (
                    <div className="glass-panel flex-center text-muted" style={{ height: '500px' }}>
                        No data available for the selected month.
                    </div>
                )}
            </div>
        </div>
    );
};

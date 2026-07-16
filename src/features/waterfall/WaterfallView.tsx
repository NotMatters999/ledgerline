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
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error && mrr.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-rose-400">
                <div className="bg-rose-500/10 p-6 rounded-2xl border border-rose-500/20">
                    <h2 className="text-xl font-bold mb-2">Error Loading Waterfall</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    const data = mrr.find(m => m.month === selectedMonth);

    return (
        <div className="w-full flex flex-col gap-6">
            <header className="mb-2 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">MRR Waterfall</h2>
                    <p className="text-gray-400 mt-1">A detailed bridge from Beginning MRR to Ending MRR.</p>
                </div>
                {mrr.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <label className="text-sm text-gray-400">Select Month</label>
                        <select 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

            <div className="w-full">
                {data ? (
                    <WaterfallChart data={data} />
                ) : (
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 h-[500px] flex items-center justify-center text-gray-500">
                        No data available for the selected month.
                    </div>
                )}
            </div>
        </div>
    );
};

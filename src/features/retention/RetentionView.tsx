import React, { useEffect } from 'react';
import { useFinancialsStore } from '../../store/financials';
import { RetentionChart } from '../../charts/RetentionChart';
import { MetricCard } from '../dashboard/MetricCard'; // reuse MetricCard

export const RetentionView: React.FC = () => {
    const { retention, isLoading, error, fetchData } = useFinancialsStore();

    useEffect(() => {
        // Assume Dashboard or App fetches data, but we fetch if empty just in case
        if (retention.length === 0) {
            fetchData('default');
        }
    }, [retention.length, fetchData]);

    if (isLoading && retention.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error && retention.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-rose-400">
                <div className="bg-rose-500/10 p-6 rounded-2xl border border-rose-500/20">
                    <h2 className="text-xl font-bold mb-2">Error Loading Retention</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    const currentNrr = retention.length > 0 ? retention[retention.length - 1].nrr * 100 : 0;
    const currentGrr = retention.length > 0 ? retention[retention.length - 1].grr * 100 : 0;
    const currentLogo = retention.length > 0 ? retention[retention.length - 1].logo_retention * 100 : 0;

    return (
        <div className="w-full flex flex-col gap-6">
            <header className="mb-2">
                <h2 className="text-2xl font-bold tracking-tight text-white">Retention Deep Dive</h2>
                <p className="text-gray-400 mt-1">Detailed analysis of revenue and customer retention metrics.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard 
                    title="Net Revenue Retention (NRR)" 
                    value={`${currentNrr.toFixed(1)}%`} 
                    subtitle="Last Month"
                />
                <MetricCard 
                    title="Gross Revenue Retention (GRR)" 
                    value={`${currentGrr.toFixed(1)}%`} 
                    subtitle="Last Month"
                />
                <MetricCard 
                    title="Logo Retention" 
                    value={`${currentLogo.toFixed(1)}%`} 
                    subtitle="Last Month"
                />
            </div>

            <div className="w-full">
                <RetentionChart data={retention} />
            </div>
        </div>
    );
};

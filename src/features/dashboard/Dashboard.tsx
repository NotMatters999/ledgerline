import React, { useEffect } from 'react';
import { useFinancialsStore } from '../../store/financials';
import { MetricCard } from './MetricCard';
import { MrrChart } from './MrrChart';
import { RetentionChart } from '../../charts/RetentionChart';

export const Dashboard: React.FC = () => {
    const { mrr, arr, retention, isLoading, error, fetchData } = useFinancialsStore();

    useEffect(() => {
        // Use default workspace 'default' for now, or fetch from workspace manager state
        fetchData('default');
    }, [fetchData]);

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-gray-900 text-white">
                <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full items-center justify-center bg-gray-900 text-rose-400">
                <div className="bg-rose-500/10 p-6 rounded-2xl border border-rose-500/20">
                    <h2 className="text-xl font-bold mb-2">Error Loading Dashboard</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    const currentMrr = mrr.length > 0 ? mrr[mrr.length - 1].ending : 0;
    const currentArr = arr.length > 0 ? arr[arr.length - 1].arr : 0;
    const currentCustomers = mrr.length > 0 ? mrr[mrr.length - 1].ending_customers : 0;
    const currentNrr = retention.length > 0 ? retention[retention.length - 1].nrr * 100 : 0;

    const formatCurrency = (val: number) => 
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    return (
        <div className="min-h-screen bg-gray-900 p-8 text-white font-sans">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">Executive Dashboard</h1>
                <p className="text-gray-400 mt-1">Real-time SaaS metrics and retention analytics.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <MetricCard 
                    title="Current ARR" 
                    value={formatCurrency(currentArr)} 
                    trend={12.5} 
                />
                <MetricCard 
                    title="Current MRR" 
                    value={formatCurrency(currentMrr)} 
                    trend={4.2} 
                />
                <MetricCard 
                    title="Active Customers" 
                    value={currentCustomers.toString()} 
                />
                <MetricCard 
                    title="Net Revenue Retention (NRR)" 
                    value={`${currentNrr.toFixed(1)}%`} 
                    subtitle="Last Month"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MrrChart data={mrr} />
                <RetentionChart data={retention} />
            </div>
        </div>
    );
};

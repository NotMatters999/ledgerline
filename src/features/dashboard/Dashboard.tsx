import React, { useEffect } from 'react';
import { useFinancialsStore } from '../../store/financials';
import { MetricCard } from './MetricCard';
import { MrrChart } from './MrrChart';
import { RetentionChart } from '../../charts/RetentionChart';

interface Props { activeWorkspaceId: string; }

export const Dashboard: React.FC<Props> = ({ activeWorkspaceId }) => {
    const { mrr, arr, retention, isLoading, error, fetchData } = useFinancialsStore();

    useEffect(() => {
        if (activeWorkspaceId && mrr.length === 0) {
            fetchData(activeWorkspaceId);
        }
    }, [activeWorkspaceId, mrr.length, fetchData]);

    if (isLoading) {
        return (
            <div className="flex-center" style={{ height: '100%', color: 'var(--text-primary)' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-center" style={{ height: '100%', padding: '2rem' }}>
                <div className="glass-panel p-6" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <h2 className="page-title" style={{ fontSize: '1.25rem', color: 'var(--status-danger)' }}>Error Loading Dashboard</h2>
                    <p className="text-muted" style={{ marginTop: '0.5rem' }}>{error}</p>
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
        <div>
            <header className="mb-8">
                <h1 className="page-title">Executive Dashboard</h1>
                <p className="page-subtitle">Real-time SaaS metrics and retention analytics.</p>
            </header>

            {mrr.length === 0 ? (
                <div className="flex-center" style={{ height: '300px', flexDirection: 'column', gap: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '1rem', border: '1px dashed rgba(255,255,255,0.1)' }}>
                    <p className="text-muted">No data available in this workspace.</p>
                    <p className="text-secondary">Navigate to the Data tab to import your CSV or Excel files.</p>
                </div>
            ) : (
                <>
                    <div className="grid-cards">
                        <MetricCard title="Current ARR"  value={formatCurrency(currentArr)} trend={12.5} />
                        <MetricCard title="Current MRR"  value={formatCurrency(currentMrr)} trend={4.2} />
                        <MetricCard title="Active Customers" value={currentCustomers.toString()} />
                        <MetricCard title="Net Revenue Retention (NRR)" value={`${currentNrr.toFixed(1)}%`} subtitle="Last Month" />
                    </div>

                    <div className="grid-charts">
                        <MrrChart data={mrr} />
                        <RetentionChart data={retention} />
                    </div>
                </>
            )}
        </div>
    );
};

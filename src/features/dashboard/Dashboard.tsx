import React, { useEffect } from 'react';
import { useFinancialsStore } from '../../store/financials';
import { MetricCard } from './MetricCard';
import { MrrChart } from './MrrChart';
import { RetentionChart } from '../../charts/RetentionChart';
import { ErrorBanner } from '../../components/ErrorBanner';
import { mapBackendError } from '../../utils/errors';

import { useWorkspaceStore } from '../../store/workspace';

export const Dashboard: React.FC = () => {
    const { mrr, arr, retention, isLoading, error, fetchData } = useFinancialsStore();

    const activeWorkspaceId = useWorkspaceStore(s => s.activeId);

    useEffect(() => {
        if (activeWorkspaceId) {
            fetchData();
        }
    }, [activeWorkspaceId, fetchData]);

    if (isLoading && mrr.length === 0) {
        return (
            <div className="flex-center" style={{ height: '100%', color: 'var(--text-primary)' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (error && mrr.length === 0 && retention.length === 0) {
        const mappedError = mapBackendError(error);
        if (mappedError) {
            return (
                <div className="flex-center" style={{ height: '100%', padding: '2rem' }}>
                    <div style={{ width: '100%', maxWidth: '600px' }}>
                        <ErrorBanner error={mappedError} onClear={() => useFinancialsStore.setState({ error: null })} />
                    </div>
                </div>
            );
        }
    }

    const currentMrr = mrr.length > 0 ? mrr[mrr.length - 1].ending : 0;
    const previousMrr = mrr.length > 1 ? mrr[mrr.length - 2].ending : null;
    const mrrTrend = (previousMrr !== null && previousMrr > 0) ? ((currentMrr - previousMrr) / previousMrr) * 100 : null;

    const currentArr = arr.length > 0 ? arr[arr.length - 1].arr : 0;
    const previousArr = arr.length > 1 ? arr[arr.length - 2].arr : null;
    const arrTrend = (previousArr !== null && previousArr > 0) ? ((currentArr - previousArr) / previousArr) * 100 : null;

    const currentCustomers = mrr.length > 0 ? mrr[mrr.length - 1].ending_customers : 0;
    const currentNrr = retention.length > 0 && retention[retention.length - 1].nrr != null 
        ? retention[retention.length - 1].nrr! * 100 
        : null;

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
                        <MetricCard title="Current ARR"  value={formatCurrency(currentArr)} trend={arrTrend !== null ? arrTrend : undefined} />
                        <MetricCard title="Current MRR"  value={formatCurrency(currentMrr)} trend={mrrTrend !== null ? mrrTrend : undefined} />
                        <MetricCard title="Active Customers" value={currentCustomers.toString()} />
                        <MetricCard title="Net Revenue Retention (NRR)" value={currentNrr !== null ? `${currentNrr.toFixed(1)}%` : 'N/A'} subtitle="Last Month" />
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

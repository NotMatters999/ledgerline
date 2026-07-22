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
            <div className="flex-center" style={{ height: '100%', color: 'var(--text-primary)' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (error && retention.length === 0) {
        return (
            <div className="flex-center" style={{ height: '100%', padding: '2rem' }}>
                <div className="glass-panel p-6" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <h2 className="page-title" style={{ fontSize: '1.25rem', color: 'var(--status-danger)' }}>Error Loading Retention</h2>
                    <p className="text-muted" style={{ marginTop: '0.5rem' }}>{error}</p>
                </div>
            </div>
        );
    }

    const currentNrr = retention.length > 0 ? retention[retention.length - 1].nrr * 100 : 0;
    const currentGrr = retention.length > 0 ? retention[retention.length - 1].grr * 100 : 0;
    const currentLogo = retention.length > 0 ? retention[retention.length - 1].logo_retention * 100 : 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header className="mb-2">
                <h2 className="page-title">Retention Deep Dive</h2>
                <p className="page-subtitle">Detailed analysis of revenue and customer retention metrics.</p>
            </header>

            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
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

            <div style={{ width: '100%' }}>
                <RetentionChart data={retention} />
            </div>
        </div>
    );
};

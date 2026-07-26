import React, { useEffect } from 'react';
import { useFinancialsStore } from '../../store/financials';
import { RetentionChart } from '../../charts/RetentionChart';
import { Tooltip } from '../../components/Tooltip';

interface Props { activeWorkspaceId: string; }

export const RetentionView: React.FC<Props> = ({ activeWorkspaceId }) => {
    const { retention, isLoading, error, fetchData } = useFinancialsStore();

    useEffect(() => {
        if (activeWorkspaceId) {
            fetchData(activeWorkspaceId);
        }
    }, [activeWorkspaceId, fetchData]);

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

    const currentNrr = (retention.length > 0 && retention[retention.length - 1].nrr !== null) ? retention[retention.length - 1].nrr! * 100 : null;
    const currentGrr = (retention.length > 0 && retention[retention.length - 1].grr !== null) ? retention[retention.length - 1].grr! * 100 : null;
    const currentLogo = (retention.length > 0 && retention[retention.length - 1].logo_retention !== null) ? retention[retention.length - 1].logo_retention! * 100 : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header className="mb-2">
                <h2 className="page-title">Retention Deep Dive</h2>
                <p className="page-subtitle">Detailed analysis of revenue and customer retention metrics.</p>
            </header>

            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                {[
                    { label: 'Net Revenue Retention', value: currentNrr !== null ? `${currentNrr.toFixed(1)}%` : 'N/A', tip: 'NRR = (Beginning MRR + Expansion − Contraction − Churn) ÷ Beginning MRR. >100% means existing customers grow faster than they churn.', positive: currentNrr !== null && currentNrr >= 100 },
                    { label: 'Gross Revenue Retention', value: currentGrr !== null ? `${currentGrr.toFixed(1)}%` : 'N/A', tip: 'GRR = (Beginning MRR − Contraction − Churn) ÷ Beginning MRR. Expansion excluded. Benchmark: >85% for B2B SaaS.', positive: currentGrr !== null && currentGrr >= 85 },
                    { label: 'Logo Retention', value: currentLogo !== null ? `${currentLogo.toFixed(1)}%` : 'N/A', tip: 'Customer-count retention: (Beginning Customers - Churned Customers) ÷ Beginning Customers. Ignores revenue weighting. Benchmark: >90% monthly.', positive: currentLogo !== null && currentLogo >= 90 },
                ].map(({ label, value, tip, positive }) => (
                    <div key={label} className="metric-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                            <p className="card-title" style={{ margin: 0 }}>{label}</p>
                            <Tooltip text={tip} />
                        </div>
                        <p className="card-value" style={{ color: value === 'N/A' ? 'var(--text-primary)' : (positive ? 'var(--accent-primary)' : 'var(--status-danger)') }}>
                            {value}
                        </p>
                        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.375rem' }}>Last Month</p>
                    </div>
                ))}
            </div>

            <div style={{ width: '100%' }}>
                <RetentionChart data={retention} />
            </div>
        </div>
    );
};

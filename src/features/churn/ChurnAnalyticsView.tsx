import React, { useEffect, useMemo } from 'react';
import { useFinancialsStore } from '../../store/financials';
import { CoreChart } from '../../charts/CoreChart';
import { Tooltip } from '../../components/Tooltip';

// Derive churn rate from retention data
export const ChurnAnalyticsView: React.FC<{ activeWorkspaceId: string }> = ({ activeWorkspaceId }) => {
    const { mrr, retention, isLoading, error, fetchData } = useFinancialsStore();

    useEffect(() => {
        if (activeWorkspaceId) fetchData(activeWorkspaceId);
    }, [activeWorkspaceId, fetchData]);

    // ── Summary metrics ─────────────────────────────────────────────────────
    const latestMrr = mrr.length > 0 ? mrr[mrr.length - 1] : null;
    const latestRet = retention.length > 0 ? retention[retention.length - 1] : null;

    const logoChurnRate = (latestRet && latestRet.logo_retention !== null)
        ? ((1 - latestRet.logo_retention) * 100).toFixed(1)
        : '—';
    const revenueChurnRate = (latestRet && latestRet.grr !== null)
        ? ((1 - latestRet.grr) * 100).toFixed(1)
        : '—';
    const grossRevenueChurn = latestMrr
        ? `$${latestMrr.churn.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : '—';
    const netRevenueChurnValue = latestMrr
        ? `$${(latestMrr.contraction + latestMrr.churn - latestMrr.expansion - latestMrr.reactivation).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : '—';
    const newVsChurn = latestMrr && latestMrr.churn > 0
        ? (latestMrr.new / latestMrr.churn).toFixed(2)
        : '—';

    // ── Trend charts ─────────────────────────────────────────────────────────
    const churnTrendOption = useMemo(() => {
        if (mrr.length === 0) return null;
        const months = mrr.map(m => m.month.substring(0, 7));
        const churnVals = mrr.map(m => m.churn);
        const newVals = mrr.map(m => m.new);
        const churnedCustomers = mrr.map(m => m.churned_customers);

        return {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis' },
            legend: { data: ['Churned MRR', 'New MRR'], textStyle: { color: '#9CA3AF' }, bottom: 0 },
            grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
            xAxis: { type: 'category', data: months, axisLabel: { color: '#9CA3AF' } },
            yAxis: [
                {
                    type: 'value',
                    name: '$',
                    axisLabel: { color: '#9CA3AF', formatter: (v: number) => `$${(v / 1000).toFixed(0)}k` },
                    splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
                },
                {
                    type: 'value',
                    name: 'Customers',
                    axisLabel: { color: '#9CA3AF' },
                    splitLine: { show: false },
                },
            ],
            series: [
                {
                    name: 'Churned MRR',
                    type: 'bar',
                    itemStyle: { color: 'rgba(244,63,94,0.7)' },
                    data: churnVals,
                },
                {
                    name: 'New MRR',
                    type: 'bar',
                    itemStyle: { color: 'rgba(16,185,129,0.7)' },
                    data: newVals,
                },
                {
                    name: 'Churned Customers',
                    type: 'line',
                    yAxisIndex: 1,
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { color: '#F43F5E', width: 2, type: 'dashed' },
                    itemStyle: { color: '#F43F5E' },
                    data: churnedCustomers,
                },
            ],
        };
    }, [mrr]);

    const logoChurnOption = useMemo(() => {
        if (retention.length === 0) return null;
        const months = retention.map(r => r.month.substring(0, 7));
        const logoRet = retention.map(r => r.logo_retention !== null ? parseFloat(((1 - r.logo_retention) * 100).toFixed(2)) : 0);
        const revenueRet = retention.map(r => r.grr !== null ? parseFloat(((1 - r.grr) * 100).toFixed(2)) : 0);

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                formatter: (params: any[]) =>
                    params.map(p => `${p.seriesName}: ${p.value}%`).join('<br/>'),
            },
            legend: { data: ['Logo Churn %', 'Revenue Churn %'], textStyle: { color: '#9CA3AF' }, bottom: 0 },
            grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
            xAxis: { type: 'category', data: months, axisLabel: { color: '#9CA3AF' } },
            yAxis: {
                type: 'value',
                min: 0,
                axisLabel: { color: '#9CA3AF', formatter: (v: number) => `${v}%` },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
            },
            series: [
                {
                    name: 'Logo Churn %',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { color: '#F59E0B', width: 2 },
                    areaStyle: { color: 'rgba(245,158,11,0.07)' },
                    data: logoRet,
                },
                {
                    name: 'Revenue Churn %',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { color: '#F43F5E', width: 2 },
                    areaStyle: { color: 'rgba(244,63,94,0.07)' },
                    data: revenueRet,
                },
            ],
        };
    }, [retention]);

    if (isLoading) {
        return (
            <div className="flex-center" style={{ height: '100%' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-center" style={{ height: '100%', padding: '2rem' }}>
                <div className="glass-panel p-6" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}>
                    <h2 className="page-title" style={{ fontSize: '1.25rem', color: 'var(--status-danger)' }}>Error Loading Churn Data</h2>
                    <p className="text-muted" style={{ marginTop: '0.5rem' }}>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header className="mb-2">
                <h2 className="page-title">Churn Analytics</h2>
                <p className="page-subtitle">Revenue and logo churn trends, with new-vs-churn coverage.</p>
            </header>

            {/* KPI Summary */}
            <div className="grid-cards">
                {[
                    {
                        label: 'Logo Churn Rate',
                        value: logoChurnRate === '—' ? '—' : `${logoChurnRate}%`,
                        tip: 'Percentage of customers who canceled this month vs total customers at start of month.',
                        danger: logoChurnRate !== '—' && parseFloat(logoChurnRate) > 5,
                    },
                    {
                        label: 'Revenue Churn Rate',
                        value: revenueChurnRate === '—' ? '—' : `${revenueChurnRate}%`,
                        tip: 'MRR lost to downgrades and cancellations, as a % of beginning MRR. AKA Gross Revenue Churn.',
                        danger: revenueChurnRate !== '—' && parseFloat(revenueChurnRate) > 5,
                    },
                    {
                        label: 'Churned MRR (Last Mo.)',
                        value: grossRevenueChurn,
                        tip: 'Absolute MRR lost to cancellations in the most recent month (Gross Churn).',
                        danger: false,
                    },
                    {
                        label: 'Net MRR Churn',
                        value: netRevenueChurnValue,
                        tip: 'Absolute MRR lost minus MRR gained from existing customers (Contraction + Churn - Expansion - Reactivation).',
                        danger: false,
                    },
                    {
                        label: 'New / Churn Coverage',
                        value: newVsChurn === '—' ? '—' : `${newVsChurn}×`,
                        tip: 'How many dollars of new MRR are being added for every dollar churned. >1× means you are growing despite churn.',
                        danger: newVsChurn !== '—' && parseFloat(newVsChurn) < 1,
                    },
                ].map(({ label, value, tip, danger }) => (
                    <div
                        key={label}
                        className="metric-card"
                        style={danger ? { borderColor: 'rgba(244,63,94,0.3)' } : {}}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                            <p className="card-title" style={{ margin: 0 }}>{label}</p>
                            <Tooltip text={tip} />
                        </div>
                        <p
                            className="card-value"
                            style={danger ? { color: 'var(--status-danger)' } : {}}
                        >
                            {value}
                        </p>
                        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.375rem' }}>Last Month</p>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <div className="glass-panel p-6" style={{ height: 400 }}>
                <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    New MRR vs Churned MRR
                </h3>
                {churnTrendOption ? (
                    <div style={{ height: 320 }}>
                        <CoreChart option={churnTrendOption} />
                    </div>
                ) : (
                    <div className="flex-center text-muted" style={{ height: 320 }}>
                        No data available. Import MRR data to get started.
                    </div>
                )}
            </div>

            <div className="glass-panel p-6" style={{ height: 380 }}>
                <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    Logo & Revenue Churn Rate Trend
                    <Tooltip text="Healthy SaaS benchmarks: logo churn &lt;2%/mo, revenue churn &lt;1%/mo for B2B." />
                </h3>
                {logoChurnOption ? (
                    <div style={{ height: 300 }}>
                        <CoreChart option={logoChurnOption} />
                    </div>
                ) : (
                    <div className="flex-center text-muted" style={{ height: 300 }}>
                        No retention data available.
                    </div>
                )}
            </div>
        </div>
    );
};

import React, { useEffect, useMemo } from 'react';
import { useFinancialsStore } from '../../store/financials';
import { CoreChart } from '../../charts/CoreChart';
import { Tooltip } from '../../components/Tooltip';

/**
 * Customer Economics View
 * Surface ARPA, customer count trends, expansion vs contraction, and reactivation.
 * All data derived from existing mrr_get / ltv_get store data — no new Rust commands needed.
 */
export const CustomerEconomicsView: React.FC<{ activeWorkspaceId: string }> = ({ activeWorkspaceId }) => {
    const { mrr, ltv, isLoading, error, fetchData } = useFinancialsStore();

    useEffect(() => {
        if (activeWorkspaceId && mrr.length === 0) fetchData(activeWorkspaceId);
    }, [activeWorkspaceId, mrr.length, fetchData]);

    const latest = mrr.length > 0 ? mrr[mrr.length - 1] : null;
    const latestLtv = ltv.length > 0 ? ltv[ltv.length - 1] : null;

    // Previous month for trend arrows
    const prev = mrr.length > 1 ? mrr[mrr.length - 2] : null;

    const arpa = latestLtv?.arpa ?? 0;
    const prevArpa = ltv.length > 1 ? ltv[ltv.length - 2].arpa : 0;
    const arpaTrend = prevArpa > 0 ? ((arpa - prevArpa) / prevArpa) * 100 : 0;

    const endingCustomers = latest?.ending_customers ?? 0;
    const prevEndingCustomers = prev?.ending_customers ?? 0;
    const customerTrend = prevEndingCustomers > 0
        ? ((endingCustomers - prevEndingCustomers) / prevEndingCustomers) * 100
        : 0;

    const expansionNet = latest ? latest.expansion - latest.contraction : 0;
    const reactivation = latest?.reactivation ?? 0;

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

    // ── ARPA Trend chart ─────────────────────────────────────────────────────
    const arpaOption = useMemo(() => {
        if (ltv.length === 0) return null;
        const months = ltv.map(d => d.month.substring(0, 7));
        const arpaVals = ltv.map(d => d.arpa);

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                formatter: (params: any[]) =>
                    `${params[0].name}<br/><strong>ARPA: ${formatCurrency(params[0].value)}</strong>`,
            },
            grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true },
            xAxis: { type: 'category', data: months, axisLabel: { color: '#9CA3AF' } },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#9CA3AF', formatter: (v: number) => `$${v.toFixed(0)}` },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
            },
            series: [
                {
                    name: 'ARPA',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { color: '#A78BFA', width: 3 },
                    itemStyle: { color: '#A78BFA' },
                    areaStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(167,139,250,0.3)' },
                                { offset: 1, color: 'rgba(167,139,250,0)' },
                            ],
                        },
                    },
                    data: arpaVals,
                },
            ],
        };
    }, [ltv]);

    // ── Customer Count chart ─────────────────────────────────────────────────
    const customerCountOption = useMemo(() => {
        if (mrr.length === 0) return null;
        const months = mrr.map(m => m.month.substring(0, 7));
        const ending = mrr.map(m => m.ending_customers);
        const newC = mrr.map(m => m.new_customers);
        const churned = mrr.map(m => -m.churned_customers);

        return {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis' },
            legend: { data: ['Ending Customers', 'New Customers', 'Churned Customers'], textStyle: { color: '#9CA3AF' }, bottom: 0 },
            grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
            xAxis: { type: 'category', data: months, axisLabel: { color: '#9CA3AF' } },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#9CA3AF' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
            },
            series: [
                {
                    name: 'Ending Customers',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { color: '#60A5FA', width: 3 },
                    itemStyle: { color: '#60A5FA' },
                    data: ending,
                },
                {
                    name: 'New Customers',
                    type: 'bar',
                    stack: 'delta',
                    itemStyle: { color: 'rgba(16,185,129,0.7)' },
                    data: newC,
                },
                {
                    name: 'Churned Customers',
                    type: 'bar',
                    stack: 'delta',
                    itemStyle: { color: 'rgba(244,63,94,0.7)' },
                    data: churned,
                },
            ],
        };
    }, [mrr]);

    // ── Expansion / Contraction / Reactivation chart ─────────────────────────
    const movementsOption = useMemo(() => {
        if (mrr.length === 0) return null;
        const months = mrr.map(m => m.month.substring(0, 7));
        const expansion = mrr.map(m => m.expansion);
        const contraction = mrr.map(m => -m.contraction);
        const reactivation = mrr.map(m => m.reactivation);

        return {
            backgroundColor: 'transparent',
            tooltip: { trigger: 'axis' },
            legend: { data: ['Expansion MRR', 'Contraction MRR', 'Reactivation MRR'], textStyle: { color: '#9CA3AF' }, bottom: 0 },
            grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
            xAxis: { type: 'category', data: months, axisLabel: { color: '#9CA3AF' } },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#9CA3AF', formatter: (v: number) => `$${(v / 1000).toFixed(0)}k` },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
            },
            series: [
                { name: 'Expansion MRR', type: 'bar', stack: 's', itemStyle: { color: '#34D399' }, data: expansion },
                { name: 'Reactivation MRR', type: 'bar', stack: 's', itemStyle: { color: '#60A5FA' }, data: reactivation },
                { name: 'Contraction MRR', type: 'bar', stack: 's', itemStyle: { color: '#F43F5E' }, data: contraction },
            ],
        };
    }, [mrr]);

    if (isLoading && mrr.length === 0) {
        return <div className="flex-center" style={{ height: '100%' }}><div className="spinner" /></div>;
    }

    if (error && mrr.length === 0) {
        return (
            <div className="flex-center" style={{ height: '100%', padding: '2rem' }}>
                <div className="glass-panel p-6" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.2)' }}>
                    <h2 className="page-title" style={{ fontSize: '1.25rem', color: 'var(--status-danger)' }}>Error Loading Customer Economics</h2>
                    <p className="text-muted" style={{ marginTop: '0.5rem' }}>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header className="mb-2">
                <h2 className="page-title">Customer Economics</h2>
                <p className="page-subtitle">ARPA, customer count dynamics, and MRR movement breakdown.</p>
            </header>

            {/* KPI Row */}
            <div className="grid-cards">
                {[
                    {
                        label: 'ARPA',
                        value: formatCurrency(arpa),
                        trend: arpaTrend,
                        tip: 'Average Revenue Per Account: Ending MRR ÷ Ending Customers. Tracks monetisation health.',
                    },
                    {
                        label: 'Active Customers',
                        value: endingCustomers.toLocaleString(),
                        trend: customerTrend,
                        tip: 'Total customers with active subscriptions at end of the last full month.',
                    },
                    {
                        label: 'Net Expansion MRR',
                        value: formatCurrency(expansionNet),
                        trend: undefined,
                        tip: 'Expansion MRR − Contraction MRR. Positive = existing customers are growing in value.',
                    },
                    {
                        label: 'Reactivation MRR',
                        value: formatCurrency(reactivation),
                        trend: undefined,
                        tip: 'MRR from previously churned customers who returned this month.',
                    },
                ].map(({ label, value, trend, tip }) => (
                    <div key={label} className="metric-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                            <p className="card-title" style={{ margin: 0 }}>{label}</p>
                            <Tooltip text={tip} />
                        </div>
                        <p className="card-value">{value}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.375rem', flexWrap: 'wrap' }}>
                            {trend !== undefined && (
                                <span className={trend >= 0 ? 'badge-positive' : 'badge-negative'}>
                                    {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
                                </span>
                            )}
                            <span className="text-muted" style={{ fontSize: '0.75rem' }}>Last Month</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ARPA Trend */}
            <div className="glass-panel p-6" style={{ height: 340 }}>
                <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    ARPA Trend
                    <Tooltip text="Rising ARPA signals better monetisation or upsell success. Declining ARPA can flag pricing pressure or a mix-shift toward lower-tier plans." />
                </h3>
                {arpaOption ? (
                    <div style={{ height: 260 }}><CoreChart option={arpaOption} /></div>
                ) : (
                    <div className="flex-center text-muted" style={{ height: 260 }}>No LTV data available.</div>
                )}
            </div>

            {/* Customer Count */}
            <div className="glass-panel p-6" style={{ height: 380 }}>
                <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    Customer Count Dynamics
                </h3>
                {customerCountOption ? (
                    <div style={{ height: 300 }}><CoreChart option={customerCountOption} /></div>
                ) : (
                    <div className="flex-center text-muted" style={{ height: 300 }}>No data.</div>
                )}
            </div>

            {/* Expansion / Contraction / Reactivation */}
            <div className="glass-panel p-6" style={{ height: 360 }}>
                <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>
                    Expansion · Contraction · Reactivation
                    <Tooltip text="Expansion = upsells. Contraction = downgrades. Reactivation = win-backs. Net Expansion should exceed contraction for healthy growth." />
                </h3>
                {movementsOption ? (
                    <div style={{ height: 280 }}><CoreChart option={movementsOption} /></div>
                ) : (
                    <div className="flex-center text-muted" style={{ height: 280 }}>No data.</div>
                )}
            </div>
        </div>
    );
};

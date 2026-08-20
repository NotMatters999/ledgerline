import React, { useEffect, useState, useMemo } from 'react';
import { useCohortStore } from '../../store/cohort';
import { CoreChart } from '../../charts/CoreChart';
import { CohortRow, CohortCell } from '../../lib/ipc/engines';
import { ErrorBanner } from '../../components/ErrorBanner';
import { mapBackendError } from '../../utils/errors';

type MetricType = 'revenue' | 'customers';
type ValueType = 'percentage' | 'absolute';

import { useWorkspaceStore } from '../../store/workspace';

export const CohortView: React.FC = () => {
    const { data, isLoading, error, fetchData } = useCohortStore();
    const [metricType, setMetricType] = useState<MetricType>('revenue');
    const [valueType, setValueType] = useState<ValueType>('percentage');

    const activeWorkspaceId = useWorkspaceStore(s => s.activeId);

    useEffect(() => {
        if (activeWorkspaceId) fetchData();
    }, [activeWorkspaceId, fetchData]);

    const option = useMemo(() => {
        if (!data || data.rows.length === 0) return null;

        // Take up to the last 12 cohorts for the trailing 12 months view
        const trailingRows = data.rows.slice(-12);
        
        // Y-axis categories (Join months) — reversed so newest cohort is at the top
        const yCategories = trailingRows.map((r: CohortRow) => r.join_month.substring(0, 7)).reverse();
        
        // X-axis categories (Months since join, max 12)
        const maxMonths = Math.min(12, trailingRows.reduce((max: number, r: CohortRow) => {
            const rowMax = r.data.reduce((m: number, d: CohortCell) => Math.max(m, d.month_index), 0);
            return Math.max(max, rowMax);
        }, 0));
        const xCategories = Array.from({ length: maxMonths + 1 }, (_, i) => `Month ${i}`);

        // Format data into [x, y, value]
        const heatmapData: [number, number, number, string][] = [];
        let maxValue = 0;

        // Iterate in reverse order (newest first) so yIndex 0 = newest cohort = yCategories[0]
        const reversedRows = [...trailingRows].reverse();
        reversedRows.forEach((row: CohortRow, yIndex: number) => {
            const initialRev = row.new_revenue;
            const initialCust = row.new_customers;

            for (let xIndex = 0; xIndex <= maxMonths; xIndex++) {
                const cell = row.data.find((d: CohortCell) => d.month_index === xIndex);
                if (!cell) continue;

                let val = 0;
                if (metricType === 'revenue') {
                    if (valueType === 'percentage') {
                        val = initialRev > 0 ? (cell.retained_revenue / initialRev) * 100 : 0;
                    } else {
                        val = cell.retained_revenue;
                    }
                } else {
                    if (valueType === 'percentage') {
                        val = initialCust > 0 ? (cell.retained_customers / initialCust) * 100 : 0;
                    } else {
                        val = cell.retained_customers;
                    }
                }

                if (val > maxValue) maxValue = val;
                
                // Format tooltip string based on type
                let tooltipStr = '';
                if (valueType === 'percentage') {
                    tooltipStr = `${val.toFixed(1)}%`;
                } else if (metricType === 'revenue') {
                    tooltipStr = `$${Math.round(val).toLocaleString()}`;
                } else {
                    tooltipStr = `${val} customers`;
                }

                heatmapData.push([xIndex, yIndex, val, tooltipStr]);
            }
        });

        // For percentage, cap visual map at 100 (or slightly above for expansion)
        const visualMax = valueType === 'percentage' ? Math.max(100, maxValue) : maxValue;

        return {
            tooltip: {
                position: 'top',
                formatter: function (params: any) {
                    return `${yCategories[params.value[1]]} (Month ${params.value[0]}):<br/><strong>${params.value[3]}</strong>`;
                }
            },
            grid: {
                height: '70%',
                top: '10%',
                left: '10%',
                right: '5%'
            },
            xAxis: {
                type: 'category',
                data: xCategories,
                splitArea: { show: true },
                axisLabel: { color: '#9CA3AF' }
            },
            yAxis: {
                type: 'category',
                data: yCategories,
                splitArea: { show: true },
                axisLabel: { color: '#9CA3AF' }
            },
            visualMap: {
                min: 0,
                max: visualMax,
                calculable: true,
                orient: 'horizontal',
                left: 'center',
                bottom: '5%',
                inRange: {
                    color: ['#111827', '#059669', '#34D399'] // dark to emerald
                },
                textStyle: { color: '#9CA3AF' },
                formatter: (value: number) => {
                    if (valueType === 'percentage') return `${value.toFixed(0)}%`;
                    if (metricType === 'revenue') return `$${Math.round(value)}`;
                    return `${Math.round(value)}`;
                }
            },
            series: [{
                name: 'Cohort',
                type: 'heatmap',
                data: heatmapData,
                label: {
                    show: true,
                    color: '#fff',
                    formatter: function(params: any) {
                        const val = params.value[2];
                        if (valueType === 'percentage') return `${val.toFixed(0)}%`;
                        if (metricType === 'revenue') return `$${val > 1000 ? (val/1000).toFixed(1) + 'k' : Math.round(val)}`;
                        return val;
                    }
                },
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }]
        };
    }, [data, metricType, valueType]);

    if (isLoading) {
        return (
            <div className="flex-center" style={{ height: '100%', color: 'var(--text-primary)' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (error) {
        const mappedError = mapBackendError(error);
        if (mappedError) {
            return (
                <div className="flex-center" style={{ height: '100%', padding: '2rem' }}>
                    <div style={{ width: '100%', maxWidth: '600px' }}>
                        <ErrorBanner error={mappedError} onClear={() => useCohortStore.setState({ error: null })} />
                    </div>
                </div>
            );
        }
    }

    return (
        <div className="glass-panel p-6" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
            <div className="flex-between mb-6">
                <h2 className="page-title" style={{ fontSize: '1.25rem', marginBottom: 0 }}>Cohort Analysis</h2>
                <div className="flex-center gap-4">
                    <div className="nav-menu">
                        <button 
                            className={`nav-item ${metricType === 'revenue' ? 'active' : ''}`}
                            onClick={() => setMetricType('revenue')}
                        >
                            Revenue
                        </button>
                        <button 
                            className={`nav-item ${metricType === 'customers' ? 'active' : ''}`}
                            onClick={() => setMetricType('customers')}
                        >
                            Customers
                        </button>
                    </div>
                    <div className="nav-menu">
                        <button 
                            className={`nav-item ${valueType === 'percentage' ? 'active' : ''}`}
                            onClick={() => setValueType('percentage')}
                        >
                            Percentage
                        </button>
                        <button 
                            className={`nav-item ${valueType === 'absolute' ? 'active' : ''}`}
                            onClick={() => setValueType('absolute')}
                        >
                            Absolute
                        </button>
                    </div>
                </div>
            </div>
            
            <div style={{ flex: 1, width: '100%', position: 'relative' }}>
                {option ? (
                    <CoreChart option={option} />
                ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        No cohort data available
                    </div>
                )}
            </div>
        </div>
    );
};

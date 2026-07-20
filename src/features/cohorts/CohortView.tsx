import React, { useEffect, useState, useMemo } from 'react';
import { useCohortStore } from '../../store/cohort';
import { CoreChart } from '../../charts/CoreChart';

type MetricType = 'revenue' | 'customers';
type ValueType = 'percentage' | 'absolute';

export const CohortView: React.FC = () => {
    const { data, isLoading, error, fetchData } = useCohortStore();
    const [metricType, setMetricType] = useState<MetricType>('revenue');
    const [valueType, setValueType] = useState<ValueType>('percentage');

    useEffect(() => {
        fetchData('default');
    }, [fetchData]);

    const option = useMemo(() => {
        if (!data || data.rows.length === 0) return null;

        // Take up to the last 12 cohorts for the trailing 12 months view
        const trailingRows = data.rows.slice(-12);
        
        // Y-axis categories (Join months) — reversed so newest cohort is at the top
        const yCategories = trailingRows.map((r: any) => r.join_month.substring(0, 7)).reverse();
        
        // X-axis categories (Months since join, max 12)
        const maxMonths = Math.min(12, Math.max(...trailingRows.map((r: any) => r.data.length - 1)));
        const xCategories = Array.from({ length: maxMonths + 1 }, (_, i) => `Month ${i}`);

        // Format data into [x, y, value]
        const heatmapData: any[] = [];
        let maxValue = 0;

        // Iterate in reverse order (newest first) so yIndex 0 = newest cohort = yCategories[0]
        const reversedRows = [...trailingRows].reverse();
        reversedRows.forEach((row: any, yIndex: number) => {
            const initialRev = row.new_revenue;
            const initialCust = row.new_customers;

            for (let xIndex = 0; xIndex <= maxMonths; xIndex++) {
                const cell = row.data.find((d: any) => d.month_index === xIndex);
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
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-full items-center justify-center text-rose-400">
                <p>Error loading cohorts: {error}</p>
            </div>
        );
    }

    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl w-full h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white tracking-tight">Cohort Analysis</h2>
                <div className="flex gap-4">
                    <div className="flex bg-gray-800 rounded-lg p-1">
                        <button 
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${metricType === 'revenue' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            onClick={() => setMetricType('revenue')}
                        >
                            Revenue
                        </button>
                        <button 
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${metricType === 'customers' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            onClick={() => setMetricType('customers')}
                        >
                            Customers
                        </button>
                    </div>
                    <div className="flex bg-gray-800 rounded-lg p-1">
                        <button 
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${valueType === 'percentage' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            onClick={() => setValueType('percentage')}
                        >
                            Percentage
                        </button>
                        <button 
                            className={`px-3 py-1 text-sm rounded-md transition-colors ${valueType === 'absolute' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
                            onClick={() => setValueType('absolute')}
                        >
                            Absolute
                        </button>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 w-full relative">
                {option ? (
                    <CoreChart option={option} />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                        No cohort data available
                    </div>
                )}
            </div>
        </div>
    );
};

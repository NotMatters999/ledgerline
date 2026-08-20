import React, { useMemo } from 'react';
import { CoreChart } from './CoreChart';
import { LtvMovement, CacMovement } from '../lib/ipc/engines';

interface LtvCacChartProps {
    ltvData: LtvMovement[];
    cacData: CacMovement[];
}

export const LtvCacChart: React.FC<LtvCacChartProps> = ({ ltvData, cacData }) => {
    const option = useMemo(() => {
        // Assume both arrays share the same timeline months
        const months = ltvData.map(d => d.month.substring(0, 7));
        const ltv = ltvData.map(d => d.ltv);
        
        // Match CAC data to LTV months
        const cac = months.map(m => {
            const match = cacData.find(c => c.month.startsWith(m));
            return match ? match.cac : null;
        });

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis'
            },
            legend: {
                data: ['LTV', 'CAC'],
                textStyle: { color: '#9CA3AF' },
                bottom: 0
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '10%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: months,
                axisLabel: { color: '#9CA3AF' }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#9CA3AF', formatter: '${value}' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
            },
            series: [
                {
                    name: 'LTV',
                    type: 'line',
                    smooth: false, // LTV can jump sharply when churn_rate changes (discontinuous formula).
                    showSymbol: true,
                    symbolSize: 4,
                    lineStyle: { width: 3, color: '#34D399' },
                    itemStyle: { color: '#34D399' },
                    data: ltv
                },
                {
                    name: 'CAC',
                    type: 'line',
                    smooth: false, // CAC is null for months with no marketing spend; sharp jumps between data points.
                    showSymbol: true,
                    symbolSize: 4,
                    lineStyle: { width: 3, color: '#F43F5E' },
                    itemStyle: { color: '#F43F5E' },
                    data: cac
                }
            ]
        };
    }, [ltvData, cacData]);

    return (
        <div className="glass-panel p-6" style={{ width: '100%', height: '400px' }}>
            <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>LTV vs CAC Trend</h3>
            <div style={{ width: '100%', height: '320px' }}>
                <CoreChart option={option} />
            </div>
        </div>
    );
};

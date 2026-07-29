import React, { useMemo } from 'react';
import { CoreChart } from './CoreChart';
import { RetentionMovement } from '../lib/ipc/engines';

interface RetentionChartProps {
    data: RetentionMovement[];
}

export const RetentionChart: React.FC<RetentionChartProps> = ({ data }) => {
    const option = useMemo(() => {
        const months = data.map(d => d.month.substring(0, 7)); // YYYY-MM
        const nrr = data.map(d => d.nrr !== null ? (d.nrr * 100).toFixed(2) : null);
        const grr = data.map(d => d.grr !== null ? (d.grr * 100).toFixed(2) : null);

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                valueFormatter: (value: any) => value != null ? `${value}%` : '-'
            },
            legend: {
                data: ['NRR', 'GRR'],
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
                axisLabel: { 
                    color: '#9CA3AF',
                    formatter: '{value} %'
                },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
                min: 50, // Usually retention charts don't start at 0 to show variation
                max: 150
            },
            series: [
                {
                    name: 'NRR',
                    type: 'line',
                    smooth: true,
                    lineStyle: { width: 3, color: '#A78BFA' }, // Purple 400
                    itemStyle: { color: '#A78BFA' },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: 'rgba(167, 139, 250, 0.5)' },
                                { offset: 1, color: 'rgba(167, 139, 250, 0.0)' }
                            ]
                        }
                    },
                    data: nrr
                },
                {
                    name: 'GRR',
                    type: 'line',
                    smooth: true,
                    lineStyle: { width: 3, color: '#FCD34D' }, // Amber 300
                    itemStyle: { color: '#FCD34D' },
                    data: grr
                }
            ]
        };
    }, [data]);

    return (
        <div className="glass-panel p-6" style={{ width: '100%', height: '400px' }}>
            <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Retention (NRR & GRR)</h3>
            <div style={{ width: '100%', height: '320px' }}>
                <CoreChart option={option} />
            </div>
        </div>
    );
};

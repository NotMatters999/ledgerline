import React, { useMemo } from 'react';
import { CoreChart } from '../../charts/CoreChart';
import { MrrMovement } from '../../lib/ipc/engines';

interface MrrChartProps {
    data: MrrMovement[];
}

export const MrrChart: React.FC<MrrChartProps> = ({ data }) => {
    const option = useMemo(() => {
        const months = data.map(d => d.month.substring(0, 7)); // YYYY-MM
        const newArr = data.map(d => d.new);
        const expansion = data.map(d => d.expansion);
        const reactivation = data.map(d => d.reactivation);
        const contraction = data.map(d => -d.contraction); // Negative for bar stack
        const churn = data.map(d => -d.churn);             // Negative for bar stack
        const ending = data.map(d => d.ending);

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' }
            },
            legend: {
                data: ['Ending MRR', 'New', 'Expansion', 'Reactivation', 'Contraction', 'Churn'],
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
                data: months,
                axisLabel: { color: '#9CA3AF' }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#9CA3AF' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
            },
            series: [
                {
                    name: 'New',
                    type: 'bar',
                    stack: 'Movement',
                    itemStyle: { color: '#34D399' }, // Emerald 400
                    data: newArr
                },
                {
                    name: 'Expansion',
                    type: 'bar',
                    stack: 'Movement',
                    itemStyle: { color: '#10B981' }, // Emerald 500
                    data: expansion
                },
                {
                    name: 'Reactivation',
                    type: 'bar',
                    stack: 'Movement',
                    itemStyle: { color: '#059669' }, // Emerald 600
                    data: reactivation
                },
                {
                    name: 'Contraction',
                    type: 'bar',
                    stack: 'Movement',
                    itemStyle: { color: '#F43F5E' }, // Rose 500
                    data: contraction
                },
                {
                    name: 'Churn',
                    type: 'bar',
                    stack: 'Movement',
                    itemStyle: { color: '#E11D48' }, // Rose 600
                    data: churn
                },
                {
                    name: 'Ending MRR',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { width: 3, color: '#60A5FA' }, // Blue 400
                    itemStyle: { color: '#60A5FA' },
                    data: ending
                }
            ]
        };
    }, [data]);

    return (
        <div className="glass-panel p-6" style={{ width: '100%', height: '400px' }}>
            <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>MRR Movements</h3>
            <div style={{ width: '100%', height: '320px' }}>
                <CoreChart option={option} />
            </div>
        </div>
    );
};

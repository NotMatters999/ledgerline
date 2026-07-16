import React, { useMemo } from 'react';
import { CoreChart } from './CoreChart';
import { ForecastMovement } from '../lib/ipc/engines';

interface ForecastChartProps {
    data: ForecastMovement[];
}

export const ForecastChart: React.FC<ForecastChartProps> = ({ data }) => {
    const option = useMemo(() => {
        const months = data.map(d => d.month.substring(0, 7));
        const ending = data.map(d => d.ending);
        const churn = data.map(d => -d.churn); // Plot as negative
        const expansion = data.map(d => d.expansion);
        const new_mrr = data.map(d => d.new);

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' }
            },
            legend: {
                data: ['Projected MRR', 'New MRR', 'Expansion', 'Churn'],
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
                    name: 'Projected MRR',
                    type: 'line',
                    smooth: true,
                    lineStyle: { width: 4, color: '#3B82F6' }, // Blue 500
                    itemStyle: { color: '#3B82F6' },
                    areaStyle: {
                        color: {
                            type: 'linear',
                            x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [{ offset: 0, color: 'rgba(59, 130, 246, 0.5)' }, { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }]
                        }
                    },
                    data: ending
                },
                {
                    name: 'New MRR',
                    type: 'bar',
                    stack: 'movements',
                    itemStyle: { color: '#34D399' }, // Emerald 400
                    data: new_mrr
                },
                {
                    name: 'Expansion',
                    type: 'bar',
                    stack: 'movements',
                    itemStyle: { color: '#10B981' }, // Emerald 500
                    data: expansion
                },
                {
                    name: 'Churn',
                    type: 'bar',
                    stack: 'movements',
                    itemStyle: { color: '#F43F5E' }, // Rose 500
                    data: churn
                }
            ]
        };
    }, [data]);

    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl w-full h-[500px]">
            <h3 className="text-gray-300 font-medium mb-4">12-Month MRR Projection</h3>
            <div className="w-full h-[400px]">
                <CoreChart option={option} />
            </div>
        </div>
    );
};

import React, { useMemo } from 'react';
import { CoreChart } from './CoreChart';
import { MrrMovement } from '../lib/ipc/engines';
import { computeWaterfall } from '../utils/waterfall';

interface WaterfallChartProps {
    data: MrrMovement;
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({ data }) => {
    const option = useMemo(() => {
        const payload = computeWaterfall(data);

        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: function (params: any[]) {
                    let tar;
                    if (params[1] && params[1].value !== '-') {
                        tar = params[1];
                    } else {
                        tar = params[0];
                    }
                    return tar.name + '<br/>' + tar.seriesName + ' : ' + tar.value;
                }
            },
            grid: {
                left: '3%',
                right: '4%',
                bottom: '3%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                splitLine: { show: false },
                data: payload.categories,
                axisLabel: { color: '#9CA3AF' }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#9CA3AF' },
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }
            },
            series: [
                {
                    name: 'Placeholder',
                    type: 'bar',
                    stack: 'Total',
                    itemStyle: {
                        borderColor: 'transparent',
                        color: 'transparent'
                    },
                    emphasis: {
                        itemStyle: {
                            borderColor: 'transparent',
                            color: 'transparent'
                        }
                    },
                    data: payload.base
                },
                {
                    name: 'Movement',
                    type: 'bar',
                    stack: 'Total',
                    label: {
                        show: true,
                        position: 'top',
                        color: '#fff',
                        formatter: (p: any) => {
                            if (p.dataIndex > 0 && p.dataIndex < payload.categories.length - 1) {
                                // Add sign for intermediate movements if we had the original
                                // The value here is positive, but we know color tells us direction
                                return p.value > 0 ? (payload.colors[p.dataIndex] === '#F43F5E' ? `-${p.value}` : `+${p.value}`) : '';
                            }
                            return p.value;
                        }
                    },
                    data: payload.value.map((val, idx) => {
                        return {
                            value: val,
                            itemStyle: {
                                color: payload.colors[idx],
                                borderRadius: payload.isTotal[idx] ? [4, 4, 0, 0] : 0
                            }
                        };
                    })
                }
            ]
        };
    }, [data]);

    return (
        <div className="glass-panel p-6" style={{ width: '100%', height: '500px' }}>
            <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>MRR Waterfall ({data.month.substring(0, 7)})</h3>
            <div style={{ width: '100%', height: '420px' }}>
                <CoreChart option={option} />
            </div>
        </div>
    );
};

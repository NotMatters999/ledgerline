import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import {
    TitleComponent,
    TooltipComponent,
    GridComponent,
    LegendComponent
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
    TitleComponent,
    TooltipComponent,
    GridComponent,
    LegendComponent,
    LineChart,
    BarChart,
    CanvasRenderer
]);

interface CoreChartProps {
    option: any;
    className?: string;
    style?: React.CSSProperties;
}

export const CoreChart: React.FC<CoreChartProps> = ({ option, className, style }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);

    useEffect(() => {
        if (!chartRef.current) return;

        if (!instanceRef.current) {
            instanceRef.current = echarts.init(chartRef.current, null, { renderer: 'canvas' });
        }

        instanceRef.current.setOption(option);

        const handleResize = () => {
            instanceRef.current?.resize();
        };

        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('resize', handleResize);
            instanceRef.current?.dispose();
            instanceRef.current = null;
        };
    }, [option]);

    return <div ref={chartRef} className={className} style={{ width: '100%', height: '100%', ...style }} />;
};

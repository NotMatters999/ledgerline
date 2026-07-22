import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, HeatmapChart } from 'echarts/charts';
import {
    TitleComponent,
    TooltipComponent,
    GridComponent,
    LegendComponent,
    VisualMapComponent,
    MarkLineComponent,
    AxisPointerComponent,
    DatasetComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
    TitleComponent,
    TooltipComponent,
    GridComponent,
    LegendComponent,
    VisualMapComponent,
    MarkLineComponent,
    LineChart,
    BarChart,
    HeatmapChart,
    CanvasRenderer,
    AxisPointerComponent,
    DatasetComponent,
]);

interface CoreChartProps {
    option: any;
    className?: string;
    style?: React.CSSProperties;
}

export const CoreChart: React.FC<CoreChartProps> = ({ option, className, style }) => {
    const chartRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<echarts.ECharts | null>(null);

    // Initialize the chart instance once and register the resize listener.
    // This effect runs only once on mount and cleans up on unmount.
    useEffect(() => {
        if (!chartRef.current) return;

        instanceRef.current = echarts.init(chartRef.current, null, { renderer: 'canvas' });

        const handleResize = () => {
            instanceRef.current?.resize();
        };
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            instanceRef.current?.dispose();
            instanceRef.current = null;
        };
    }, []); // empty deps — run once

    // Update the chart option whenever it changes, without recreating the instance.
    useEffect(() => {
        if (instanceRef.current) {
            instanceRef.current.setOption(option, { notMerge: false });
        }
    }, [option]);

    return <div ref={chartRef} className={className} style={{ width: '100%', height: '100%', ...style }} />;
};

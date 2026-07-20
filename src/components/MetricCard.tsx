import React from 'react';

interface MetricCardProps {
    title: string;
    value: string;
    subtitle?: string;
    trend?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, trend }) => {
    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-transform hover:-translate-y-1 hover:shadow-2xl duration-300">
            <h3 className="text-gray-400 text-sm font-medium tracking-wide">{title}</h3>
            <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-white tracking-tight">{value}</span>
                {trend !== undefined && (
                    <span className={`text-sm font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
            {subtitle && <p className="text-gray-500 text-xs mt-2">{subtitle}</p>}
        </div>
    );
};

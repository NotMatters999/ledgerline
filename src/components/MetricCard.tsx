import React from 'react';

interface MetricCardProps {
    title: string;
    value: string;
    subtitle?: string;
    trend?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, trend }) => {
    return (
        <div className="glass-panel animated-card p-6 metric-card-content">
            <h3 className="card-title">{title}</h3>
            <div className="flex-center" style={{ justifyContent: 'flex-start', gap: '0.5rem', marginTop: '1rem' }}>
                <span className="card-value">{value}</span>
                {trend !== undefined && (
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }} className={trend >= 0 ? 'trend-up' : 'trend-down'}>
                        {trend > 0 ? '+' : ''}{trend}%
                    </span>
                )}
            </div>
            {subtitle && <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>{subtitle}</p>}
        </div>
    );
};

import React, { useState, useEffect, useRef } from 'react';
import { ForecastMovement, getForecast } from '../../lib/ipc/engines';
import { ForecastChart } from '../../charts/ForecastChart';
import { MetricCard } from '../dashboard/MetricCard';
import { ErrorBanner } from '../../components/ErrorBanner';
import { mapBackendError } from '../../utils/errors';

import { useWorkspaceStore } from '../../store/workspace';

export const ForecastingView: React.FC = () => {
    const activeWorkspaceId = useWorkspaceStore(s => s.activeId);
    const [churnRate, setChurnRate] = useState<number>(2.0); // 2.0%
    const [expansionRate, setExpansionRate] = useState<number>(3.0); // 3.0%
    const [newMrr, setNewMrr] = useState<number>(1000); // $1,000

    const [forecastData, setForecastData] = useState<ForecastMovement[]>([]);
    const [error, setError] = useState<string | null>(null);
    
    const [avgLatency, setAvgLatency] = useState<number>(0);
    const latencyLog = useRef<number[]>([]);

    const debounceRef = useRef<number | null>(null);

    const fetchForecast = React.useCallback(async (churn: number, exp: number, newM: number) => {
        const startTime = performance.now();
        
        try {
            const data = await getForecast({
                monthly_churn_rate: churn / 100.0,
                monthly_expansion_rate: exp / 100.0,
                new_mrr_per_month: newM
            });
            
            const endTime = performance.now();
            const latency = endTime - startTime;
            
            // Track latency for benchmark
            latencyLog.current.push(latency);
            if (latencyLog.current.length > 20) latencyLog.current.shift();
            const avg = latencyLog.current.reduce((a,b) => a+b, 0) / latencyLog.current.length;
            setAvgLatency(avg);
            
            setForecastData(data);
            setError(null);
        } catch (err: any) {
            setError(err.toString());
        }
    }, [activeWorkspaceId]);

    useEffect(() => {
        // Debounce real-time inputs
        if (debounceRef.current) {
            window.clearTimeout(debounceRef.current);
        }
        
        debounceRef.current = window.setTimeout(() => {
            fetchForecast(churnRate, expansionRate, newMrr);
        }, 80);

        return () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
        };
    }, [churnRate, expansionRate, newMrr, fetchForecast]);

    const formatCurrency = (val: number) => 
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    const endMrr = forecastData.length > 0 ? forecastData[forecastData.length - 1].ending : 0;
    const endMonth = forecastData.length > 0 ? forecastData[forecastData.length - 1].month.substring(0, 7) : '-';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header className="mb-2 flex-between" style={{ alignItems: 'flex-end' }}>
                <div>
                    <h2 className="page-title">Scenario Forecasting</h2>
                    <p className="page-subtitle" style={{ marginBottom: 0 }}>Interactive 12-month MRR projection model.</p>
                </div>
                {avgLatency > 0 && (
                    <div style={{ 
                        fontSize: '0.75rem', padding: '0.25rem 0.75rem', borderRadius: '9999px', border: '1px solid',
                        background: avgLatency < 200 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: avgLatency < 200 ? 'var(--status-success)' : 'var(--status-warning)',
                        borderColor: avgLatency < 200 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'
                    }}>
                        Avg Latency: {avgLatency.toFixed(1)}ms
                    </div>
                )}
            </header>

            {error && mapBackendError(error) && (
                <ErrorBanner error={mapBackendError(error)} onClear={() => setError(null)} />
            )}

            <div className="grid-cards">
                <MetricCard 
                    title={`Projected MRR (${endMonth})`} 
                    value={formatCurrency(endMrr)} 
                    subtitle="At end of 12-month period"
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                <div style={{ flex: '2 1 600px' }}>
                    <ForecastChart data={forecastData} />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: '1 1 300px' }}>
                    <div className="glass-panel p-6" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        
                        <div>
                            <div className="flex-between mb-2">
                                <label className="text-muted" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Monthly Churn Rate</label>
                                <span className="text-accent" style={{ fontSize: '0.875rem' }}>{churnRate.toFixed(1)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="10" step="0.1" 
                                value={churnRate} 
                                onChange={(e) => setChurnRate(parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                            />
                        </div>

                        <div>
                            <div className="flex-between mb-2">
                                <label className="text-muted" style={{ fontSize: '0.875rem', fontWeight: 500 }}>Monthly Expansion Rate</label>
                                <span className="text-accent" style={{ fontSize: '0.875rem' }}>{expansionRate.toFixed(1)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="20" step="0.1" 
                                value={expansionRate} 
                                onChange={(e) => setExpansionRate(parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                            />
                        </div>

                        <div>
                            <div className="flex-between mb-2">
                                <label className="text-muted" style={{ fontSize: '0.875rem', fontWeight: 500 }}>New MRR Added / Month</label>
                                <span className="text-accent" style={{ fontSize: '0.875rem' }}>{formatCurrency(newMrr)}</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="10000" step="100" 
                                value={newMrr} 
                                onChange={(e) => setNewMrr(parseFloat(e.target.value))}
                                style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

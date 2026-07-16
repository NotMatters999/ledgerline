import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ForecastMovement } from '../../lib/ipc/engines';
import { ForecastChart } from '../../charts/ForecastChart';
import { MetricCard } from '../dashboard/MetricCard';

export const ForecastingView: React.FC = () => {
    const [churnRate, setChurnRate] = useState<number>(2.0); // 2.0%
    const [expansionRate, setExpansionRate] = useState<number>(3.0); // 3.0%
    const [newMrr, setNewMrr] = useState<number>(1000); // $1,000

    const [forecastData, setForecastData] = useState<ForecastMovement[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isCalculating, setIsCalculating] = useState<boolean>(true);
    
    const [avgLatency, setAvgLatency] = useState<number>(0);
    const latencyLog = useRef<number[]>([]);

    const debounceRef = useRef<number | null>(null);

    const fetchForecast = async (churn: number, exp: number, newM: number) => {
        setIsCalculating(true);
        const startTime = performance.now();
        
        try {
            const data = await invoke<ForecastMovement[]>('forecast_get', {
                workspaceId: 'default',
                params: {
                    monthly_churn_rate: churn / 100.0,
                    monthly_expansion_rate: exp / 100.0,
                    new_mrr_per_month: newM
                }
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
        } finally {
            setIsCalculating(false);
        }
    };

    useEffect(() => {
        // Debounce real-time inputs
        if (debounceRef.current) {
            window.clearTimeout(debounceRef.current);
        }
        
        debounceRef.current = window.setTimeout(() => {
            fetchForecast(churnRate, expansionRate, newMrr);
        }, 80); // 80ms debounce for responsive drag while keeping <200ms budget safe

        return () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
        };
    }, [churnRate, expansionRate, newMrr]);

    const formatCurrency = (val: number) => 
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    const endMrr = forecastData.length > 0 ? forecastData[forecastData.length - 1].ending : 0;
    const endMonth = forecastData.length > 0 ? forecastData[forecastData.length - 1].month.substring(0, 7) : '-';

    return (
        <div className="w-full flex flex-col gap-6">
            <header className="mb-2 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">Scenario Forecasting</h2>
                    <p className="text-gray-400 mt-1">Interactive 12-month MRR projection model.</p>
                </div>
                {avgLatency > 0 && (
                    <div className={`text-xs px-3 py-1 rounded-full border ${avgLatency < 200 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                        Avg Latency: {avgLatency.toFixed(1)}ms
                    </div>
                )}
            </header>

            {error && (
                <div className="bg-rose-500/10 text-rose-400 p-4 rounded-xl border border-rose-500/20">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard 
                    title={`Projected MRR (${endMonth})`} 
                    value={formatCurrency(endMrr)} 
                    subtitle="At end of 12m period"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <ForecastChart data={forecastData} />
                </div>
                
                <div className="flex flex-col gap-6">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col gap-6">
                        
                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium text-gray-300">Monthly Churn Rate</label>
                                <span className="text-sm text-emerald-400">{churnRate.toFixed(1)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="10" step="0.1" 
                                value={churnRate} 
                                onChange={(e) => setChurnRate(parseFloat(e.target.value))}
                                className="w-full accent-emerald-500"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium text-gray-300">Monthly Expansion Rate</label>
                                <span className="text-sm text-emerald-400">{expansionRate.toFixed(1)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="20" step="0.1" 
                                value={expansionRate} 
                                onChange={(e) => setExpansionRate(parseFloat(e.target.value))}
                                className="w-full accent-emerald-500"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="text-sm font-medium text-gray-300">New MRR Added / Month</label>
                                <span className="text-sm text-emerald-400">{formatCurrency(newMrr)}</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="10000" step="100" 
                                value={newMrr} 
                                onChange={(e) => setNewMrr(parseFloat(e.target.value))}
                                className="w-full accent-emerald-500"
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

import React, { useEffect, useState } from 'react';
import { useFinancialsStore } from '../../store/financials';
import { MetricCard } from '../dashboard/MetricCard';
import { LtvCacChart } from '../../charts/LtvCacChart';
import { setSetting, getSettingF64, addMarketingSpend } from '../../lib/ipc/settings';

export const UnitEconomicsView: React.FC = () => {
    const { ltv, cac, payback, mrr, isLoading, error, fetchData } = useFinancialsStore();

    const [grossMarginInput, setGrossMarginInput] = useState<string>('');
    const [spendPeriodInput, setSpendPeriodInput] = useState<string>('');
    const [spendAmountInput, setSpendAmountInput] = useState<string>('');
    
    const [submittingMargin, setSubmittingMargin] = useState(false);
    const [submittingSpend, setSubmittingSpend] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    // Initialize inputs
    useEffect(() => {
        if (ltv.length === 0) {
            fetchData('default');
        }
        
        getSettingF64('default', 'gross_margin')
            .then(val => setGrossMarginInput((val * 100).toString()))
            .catch(() => setGrossMarginInput('100')); // Default is 100%

        if (mrr.length > 0) {
            setSpendPeriodInput(mrr[mrr.length - 1].month);
        }
    }, [ltv.length, mrr.length, mrr, fetchData]);

    const handleMarginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingMargin(true);
        setActionError(null);
        try {
            const percentage = parseFloat(grossMarginInput);
            if (isNaN(percentage) || percentage < 0 || percentage > 100) {
                throw new Error("Gross margin must be between 0 and 100");
            }
            const decimal = percentage / 100;
            await setSetting('default', 'gross_margin', decimal.toString());
            await fetchData('default'); // Global refetch to update all charts
        } catch (err: any) {
            setActionError(err.toString());
        } finally {
            setSubmittingMargin(false);
        }
    };

    const handleSpendSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittingSpend(true);
        setActionError(null);
        try {
            const amount = parseFloat(spendAmountInput);
            if (isNaN(amount) || amount < 0) {
                throw new Error("Marketing spend must be a positive number");
            }
            if (!spendPeriodInput) {
                throw new Error("Please select a month");
            }
            
            await addMarketingSpend('default', spendPeriodInput, amount, 'Total');
            setSpendAmountInput('');
            await fetchData('default'); // Global refetch
        } catch (err: any) {
            setActionError(err.toString());
        } finally {
            setSubmittingSpend(false);
        }
    };

    if (isLoading && ltv.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error && ltv.length === 0) {
        return (
            <div className="flex h-full items-center justify-center text-rose-400">
                <div className="bg-rose-500/10 p-6 rounded-2xl border border-rose-500/20">
                    <h2 className="text-xl font-bold mb-2">Error Loading Unit Economics</h2>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    const currentLtv = ltv.length > 0 ? ltv[ltv.length - 1].ltv : 0;
    const currentCac = cac.length > 0 ? cac[cac.length - 1].cac : 0;
    const currentPayback = payback.length > 0 ? payback[payback.length - 1].payback_months : 0;
    const currentRatio = currentCac > 0 ? currentLtv / currentCac : 0;

    const formatCurrency = (val: number) => 
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

    return (
        <div className="w-full flex flex-col gap-6">
            <header className="mb-2">
                <h2 className="text-2xl font-bold tracking-tight text-white">Unit Economics</h2>
                <p className="text-gray-400 mt-1">LTV, CAC, and Payback Period Analysis.</p>
            </header>

            {actionError && (
                <div className="bg-rose-500/10 text-rose-400 p-4 rounded-xl border border-rose-500/20">
                    {actionError}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                    title="Customer LTV" 
                    value={formatCurrency(currentLtv)} 
                    subtitle="Last Month"
                />
                <MetricCard 
                    title="Customer CAC" 
                    value={formatCurrency(currentCac)} 
                    subtitle="Last Month"
                />
                <MetricCard 
                    title="LTV:CAC Ratio" 
                    value={`${currentRatio.toFixed(1)}x`} 
                    subtitle="Last Month"
                />
                <MetricCard 
                    title="Payback Period" 
                    value={`${currentPayback.toFixed(1)} mo`} 
                    subtitle="Last Month"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <LtvCacChart ltvData={ltv} cacData={cac} />
                </div>
                
                <div className="flex flex-col gap-6">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-gray-300 font-medium mb-4">Gross Margin</h3>
                        <form onSubmit={handleMarginSubmit} className="flex flex-col gap-3">
                            <label className="text-sm text-gray-400">Global Margin % (0-100)</label>
                            <input 
                                type="number" 
                                step="0.1"
                                min="0"
                                max="100"
                                value={grossMarginInput}
                                onChange={e => setGrossMarginInput(e.target.value)}
                                className="bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <button 
                                type="submit" 
                                disabled={submittingMargin}
                                className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md py-2 font-medium transition-colors"
                            >
                                {submittingMargin ? 'Updating...' : 'Update Margin'}
                            </button>
                        </form>
                    </div>

                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl">
                        <h3 className="text-gray-300 font-medium mb-4">Marketing Spend</h3>
                        <form onSubmit={handleSpendSubmit} className="flex flex-col gap-3">
                            <label className="text-sm text-gray-400">Month</label>
                            <select 
                                value={spendPeriodInput}
                                onChange={e => setSpendPeriodInput(e.target.value)}
                                className="bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            >
                                {[...mrr].reverse().map(m => (
                                    <option key={m.month} value={m.month}>
                                        {m.month.substring(0, 7)}
                                    </option>
                                ))}
                            </select>
                            
                            <label className="text-sm text-gray-400 mt-2">Spend Amount ($)</label>
                            <input 
                                type="number" 
                                step="1"
                                min="0"
                                value={spendAmountInput}
                                onChange={e => setSpendAmountInput(e.target.value)}
                                className="bg-gray-900 border border-gray-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="e.g. 5000"
                            />
                            <button 
                                type="submit" 
                                disabled={submittingSpend}
                                className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md py-2 font-medium transition-colors"
                            >
                                {submittingSpend ? 'Adding...' : 'Add Spend'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

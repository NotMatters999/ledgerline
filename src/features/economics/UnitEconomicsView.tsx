import React, { useEffect, useState } from 'react';
import { useFinancialsStore } from '../../store/financials';
import { MetricCard } from '../dashboard/MetricCard';
import { LtvCacChart } from '../../charts/LtvCacChart';
import { setSetting, getSettingF64, addMarketingSpend } from '../../lib/ipc/settings';
import { Tooltip } from '../../components/Tooltip';


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
                throw new Error("Marketing spend must be a non-negative number (0 or greater)");
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
            <div className="flex-center" style={{ height: '100%', color: 'var(--text-primary)' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    if (error && ltv.length === 0) {
        return (
            <div className="flex-center" style={{ height: '100%', padding: '2rem' }}>
                <div className="glass-panel p-6" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                    <h2 className="page-title" style={{ fontSize: '1.25rem', color: 'var(--status-danger)' }}>Error Loading Unit Economics</h2>
                    <p className="text-muted" style={{ marginTop: '0.5rem' }}>{error}</p>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <header className="mb-2">
                <h2 className="page-title">Unit Economics</h2>
                <p className="page-subtitle">LTV, CAC, and Payback Period Analysis.</p>
            </header>

            {actionError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-danger)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    {actionError}
                </div>
            )}

            <div className="grid-cards">
                {[
                    { label: 'Customer LTV', value: formatCurrency(currentLtv), tip: 'Lifetime Value = ARPA × Gross Margin ÷ Churn Rate. Estimates total revenue from an average customer over their lifetime.' },
                    { label: 'Customer CAC', value: formatCurrency(currentCac), tip: 'Customer Acquisition Cost = Marketing Spend ÷ New Customers acquired that month.' },
                    { label: 'LTV:CAC Ratio', value: `${currentRatio.toFixed(1)}x`, tip: 'Benchmark: >3× is healthy for B2B SaaS. Below 1× means you spend more to acquire than you recover.' },
                    { label: 'Payback Period', value: `${currentPayback.toFixed(1)} mo`, tip: 'Months to recover CAC from gross margin. Benchmark: <12 months for efficient SaaS growth.' },
                ].map(({ label, value, tip }) => (
                    <div key={label} className="metric-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                            <p className="card-title" style={{ margin: 0 }}>{label}</p>
                            <Tooltip text={tip} />
                        </div>
                        <p className="card-value">{value}</p>
                        <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.375rem' }}>Last Month</p>
                    </div>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
                <div style={{ flex: '2 1 600px' }}>
                    <LtvCacChart ltvData={ltv} cacData={cac} />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: '1 1 300px' }}>
                    <div className="glass-panel p-6">
                        <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Gross Margin</h3>
                        <form onSubmit={handleMarginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <label className="text-muted" style={{ fontSize: '0.875rem' }}>Global Margin % (0-100)</label>
                            <input 
                                type="number" 
                                step="0.1"
                                min="0"
                                max="100"
                                value={grossMarginInput}
                                onChange={e => setGrossMarginInput(e.target.value)}
                                className="input-field"
                            />
                            <button 
                                type="submit" 
                                disabled={submittingMargin}
                                className="btn-primary mt-4"
                            >
                                {submittingMargin ? 'Updating...' : 'Update Margin'}
                            </button>
                        </form>
                    </div>

                    <div className="glass-panel p-6">
                        <h3 className="card-title" style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Marketing Spend</h3>
                        <form onSubmit={handleSpendSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <label className="text-muted" style={{ fontSize: '0.875rem' }}>Month</label>
                            <select 
                                value={spendPeriodInput}
                                onChange={e => setSpendPeriodInput(e.target.value)}
                                className="input-field"
                            >
                                {[...mrr].reverse().map(m => (
                                    <option key={m.month} value={m.month}>
                                        {m.month.substring(0, 7)}
                                    </option>
                                ))}
                            </select>
                            
                            <label className="text-muted mt-4" style={{ fontSize: '0.875rem' }}>Spend Amount ($)</label>
                            <input 
                                type="number" 
                                step="1"
                                min="0"
                                value={spendAmountInput}
                                onChange={e => setSpendAmountInput(e.target.value)}
                                className="input-field"
                                placeholder="e.g. 5000"
                            />
                            <button 
                                type="submit" 
                                disabled={submittingSpend}
                                className="btn-primary mt-4"
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

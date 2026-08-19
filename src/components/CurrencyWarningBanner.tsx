import React, { useEffect, useState } from 'react';
import { getCurrenciesMissingRates } from '../lib/ipc/settings';
import { useWorkspaceStore } from '../store/workspace';
import { useFinancialsStore } from '../store/financials';

/**
 * Shows a warning strip when mrr_log contains currencies that have no
 * configured exchange rate.  Disappears automatically once all rates are set.
 *
 * Pass `onGoToSettings` to let the user jump straight to the Currency Rates
 * section of the Settings page.
 */
interface Props {
    onGoToSettings?: () => void;
}

export const CurrencyWarningBanner: React.FC<Props> = ({ onGoToSettings }) => {
    const [missing, setMissing] = useState<string[]>([]);
    const activeWorkspaceId = useWorkspaceStore(s => s.activeId);
    // Re-check whenever the financials store is refreshed (i.e. after import or
    // rate save), by subscribing to the data version counter.
    const dataVersion = useFinancialsStore(s => s.mrr.length);

    useEffect(() => {
        if (!activeWorkspaceId) {
            setMissing([]);
            return;
        }
        getCurrenciesMissingRates()
            .then(setMissing)
            .catch(() => setMissing([])); // silently swallow — it's just a hint
    }, [activeWorkspaceId, dataVersion]);

    if (missing.length === 0) return null;

    return (
        <div
            role="alert"
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '0.625rem',
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.3)',
                fontSize: '0.8125rem',
                color: 'var(--text-secondary)',
            }}
        >
            {/* Warning icon */}
            <svg
                width="16" height="16" fill="none" viewBox="0 0 24 24"
                stroke="rgba(245,158,11,0.9)" strokeWidth={2}
                style={{ flexShrink: 0 }}
            >
                <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>

            <span style={{ flex: 1 }}>
                <strong style={{ color: 'rgba(245,158,11,0.95)' }}>Mixed currencies detected</strong>
                {' — '}
                <span style={{ fontFamily: 'monospace' }}>{missing.join(', ')}</span>
                {' '}
                {missing.length === 1
                    ? 'has no exchange rate configured.'
                    : 'have no exchange rates configured.'}
                {' '}
                All amounts are summed as-is (1:1). Dollar figures may be inaccurate.
            </span>

            {onGoToSettings && (
                <button
                    onClick={onGoToSettings}
                    style={{
                        flexShrink: 0,
                        background: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.3)',
                        borderRadius: '0.375rem',
                        color: 'rgba(245,158,11,0.95)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '0.25rem 0.75rem',
                        whiteSpace: 'nowrap',
                        fontFamily: 'var(--font-sans)',
                    }}
                >
                    Configure Rates →
                </button>
            )}
        </div>
    );
};

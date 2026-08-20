import { invokeWorkspace } from './client';

export interface ExchangeRate {
    currency: string;
    rate_to_base: number;
}

export async function setSetting(key: string, value: string): Promise<void> {
    return await invokeWorkspace<void>('setting_set', { key, value });
}

export async function getSetting(key: string): Promise<string> {
    return await invokeWorkspace<string>('setting_get', { key });
}

export async function getSettingF64(key: string): Promise<number> {
    return await invokeWorkspace<number>('setting_get_f64', { key });
}

export async function addMarketingSpend(period: string, amount: number): Promise<void> {
    return await invokeWorkspace<void>('marketing_spend_add', { period, amount });
}

/** Return all currently configured exchange rates for this workspace. */
export async function getExchangeRates(): Promise<ExchangeRate[]> {
    return await invokeWorkspace<ExchangeRate[]>('exchange_rates_get', {});
}

/** Batch-upsert exchange rates (currency → rate_to_base). */
export async function setExchangeRates(rates: ExchangeRate[]): Promise<void> {
    return await invokeWorkspace<void>('exchange_rates_set', { rates });
}

/**
 * Return currency codes that exist in mrr_log but have no entry in
 * exchange_rates.  Empty array = all currencies covered (or single-currency).
 */
export async function getCurrenciesMissingRates(): Promise<string[]> {
    return await invokeWorkspace<string[]>('currencies_missing_rates_get', {});
}

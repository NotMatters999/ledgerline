import { invokeWorkspace } from './client';

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

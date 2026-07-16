import { invoke } from '@tauri-apps/api/core';

export async function setSetting(workspaceId: string, key: string, value: string): Promise<void> {
    return await invoke<void>('setting_set', { workspaceId, key, value });
}

export async function getSetting(workspaceId: string, key: string): Promise<string> {
    return await invoke<string>('setting_get', { workspaceId, key });
}

export async function getSettingF64(workspaceId: string, key: string): Promise<number> {
    return await invoke<number>('setting_get_f64', { workspaceId, key });
}

export async function addMarketingSpend(workspaceId: string, period: string, amount: number, channel: string): Promise<void> {
    return await invoke<void>('marketing_spend_add', { workspaceId, period, amount, channel });
}

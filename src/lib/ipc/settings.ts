import { invoke } from '@tauri-apps/api/core';

export async function setSetting(workspaceId: string, key: string, value: string): Promise<void> {
    return await invoke<void>('setting_set', { workspace_id: workspaceId, key, value });
}

export async function getSetting(workspaceId: string, key: string): Promise<string> {
    return await invoke<string>('setting_get', { workspace_id: workspaceId, key });
}

export async function getSettingF64(workspaceId: string, key: string): Promise<number> {
    return await invoke<number>('setting_get_f64', { workspace_id: workspaceId, key });
}

export async function addMarketingSpend(workspaceId: string, period: string, amount: number): Promise<void> {
    return await invoke<void>('marketing_spend_add', { workspace_id: workspaceId, period, amount });
}

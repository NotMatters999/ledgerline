import { invoke } from '@tauri-apps/api/core';

export async function listBackups(workspaceId: string): Promise<string[]> {
    return await invoke<string[]>('backup_list', { workspaceId });
}

export async function createBackup(workspaceId: string): Promise<string> {
    return await invoke<string>('backup_create', { workspaceId });
}

export async function requestRestore(workspaceId: string, filename: string): Promise<string> {
    return await invoke<string>('backup_restore_request', { workspaceId, filename });
}

export async function confirmRestore(workspaceId: string, filename: string, token: string): Promise<void> {
    return await invoke<void>('backup_restore_confirm', { workspaceId, filename, token });
}

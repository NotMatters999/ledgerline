import { invoke } from '@tauri-apps/api/core';

export async function listBackups(workspaceId: string): Promise<string[]> {
    return await invoke<string[]>('backup_list', { workspace_id: workspaceId });
}

export async function createBackup(workspaceId: string): Promise<string> {
    return await invoke<string>('backup_create', { workspace_id: workspaceId });
}

export async function requestRestore(workspaceId: string, filename: string): Promise<string> {
    return await invoke<string>('backup_restore_request', { workspace_id: workspaceId, filename });
}

export async function confirmRestore(workspaceId: string, filename: string, token: string): Promise<void> {
    await invoke('backup_restore_confirm', { workspace_id: workspaceId, filename, token });
}

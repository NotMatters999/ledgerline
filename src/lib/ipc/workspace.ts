import { invoke } from '@tauri-apps/api/core';

export interface Workspace {
    id: string;
    name: string;
    created_at: string;
    last_accessed: string;
    db_path: string;
}

export async function listWorkspaces(): Promise<Workspace[]> {
    return await invoke<Workspace[]>('workspace_list');
}

export async function createWorkspace(name: string): Promise<Workspace> {
    return await invoke<Workspace>('workspace_create', { name });
}

export async function renameWorkspace(id: string, newName: string): Promise<Workspace> {
    return await invoke<Workspace>('workspace_rename', { id, new_name: newName });
}

export async function switchWorkspace(id: string): Promise<Workspace> {
    return await invoke<Workspace>('workspace_switch', { id });
}

export async function requestDeleteWorkspace(id: string): Promise<string> {
    return await invoke<string>('workspace_delete_request', { id });
}

export async function confirmDeleteWorkspace(id: string, token: string): Promise<void> {
    return await invoke<void>('workspace_delete_confirm', { id, token });
}

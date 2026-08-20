import { invokeWorkspace } from './client';

export async function listBackups(): Promise<string[]> {
    return await invokeWorkspace<string[]>('backup_list');
}

export async function createBackup(): Promise<string> {
    return await invokeWorkspace<string>('backup_create');
}

export async function requestRestore(filename: string): Promise<string> {
    return await invokeWorkspace<string>('backup_restore_request', { filename });
}

export async function confirmRestore(filename: string, token: string): Promise<void> {
    await invokeWorkspace('backup_restore_confirm', { filename, token });
}

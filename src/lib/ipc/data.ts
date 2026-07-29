import { invoke } from '@tauri-apps/api/core';

export interface MrrLogRow {
    rowid: number;
    customer_id: string;
    period: string;
    mrr_amount: number;
    currency: string;
    category?: string | null;
}

export interface MrrLogAddPayload {
    customer_id: string;
    period: string;
    mrr_amount: number;
    currency: string;
    category?: string | null;
}

export async function listMrrLog(
    workspaceId: string,
    search: string = '',
    sortBy: string = 'period',
    sortDir: string = 'DESC',
    offset: number = 0,
    limit: number = 50,
): Promise<MrrLogRow[]> {
    return await invoke<MrrLogRow[]>('mrr_log_list', {
        workspace_id: workspaceId,
        search,
        sort_by: sortBy,
        sort_dir: sortDir,
        offset,
        limit,
    });
}

export async function countMrrLog(workspaceId: string, search: string = ''): Promise<number> {
    return await invoke<number>('mrr_log_count', { workspace_id: workspaceId, search });
}

export async function addMrrLog(workspaceId: string, row: MrrLogAddPayload): Promise<void> {
    return await invoke<void>('mrr_log_add', { workspace_id: workspaceId, row });
}

export async function requestDeleteMrrLog(workspaceId: string, rowid: number): Promise<string> {
    return await invoke<string>('mrr_log_delete_request', { workspace_id: workspaceId, rowid });
}

export async function confirmDeleteMrrLog(workspaceId: string, rowid: number, token: string): Promise<MrrLogRow> {
    return await invoke<MrrLogRow>('mrr_log_delete_confirm', { workspace_id: workspaceId, rowid, token });
}

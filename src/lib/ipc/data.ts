import { invoke } from '@tauri-apps/api/core';

export interface MrrLogRow {
    rowid: number;
    customer_id: string;
    period: string;
    mrr_amount: number;
    currency: string;
}

export interface MrrLogAddPayload {
    customer_id: string;
    period: string;
    mrr_amount: number;
    currency: string;
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
        workspaceId,
        search,
        sortBy,
        sortDir,
        offset,
        limit,
    });
}

export async function countMrrLog(workspaceId: string, search: string = ''): Promise<number> {
    return await invoke<number>('mrr_log_count', { workspaceId, search });
}

export async function addMrrLog(workspaceId: string, row: MrrLogAddPayload): Promise<void> {
    return await invoke<void>('mrr_log_add', { workspaceId, row });
}

export async function deleteMrrLog(workspaceId: string, rowid: number): Promise<MrrLogRow> {
    return await invoke<MrrLogRow>('mrr_log_delete', { workspaceId, rowid });
}

import { invokeWorkspace } from './client';

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
    search: string = '',
    sortBy: string = 'period',
    sortDir: string = 'DESC',
    offset: number = 0,
    limit: number = 50,
): Promise<MrrLogRow[]> {
    return await invokeWorkspace<MrrLogRow[]>('mrr_log_list', {
        search,
        sort_by: sortBy,
        sort_dir: sortDir,
        offset,
        limit,
    });
}

export async function countMrrLog(search: string = ''): Promise<number> {
    return await invokeWorkspace<number>('mrr_log_count', { search });
}

export async function addMrrLog(row: MrrLogAddPayload): Promise<void> {
    return await invokeWorkspace<void>('mrr_log_add', { row });
}

export async function requestDeleteMrrLog(rowid: number): Promise<string> {
    return await invokeWorkspace<string>('mrr_log_delete_request', { rowid });
}

export async function confirmDeleteMrrLog(rowid: number, token: string): Promise<MrrLogRow> {
    return await invokeWorkspace<MrrLogRow>('mrr_log_delete_confirm', { rowid, token });
}

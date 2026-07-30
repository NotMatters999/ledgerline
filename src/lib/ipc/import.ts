import { invokeWorkspace } from './client';

export interface MappedColumns {
    customer_id_idx: number | null;
    revenue_idx: number | null;
    date_idx: number | null;
    currency_idx: number | null;
    category_idx: number | null;
    other_cols: number[];
}

export interface PreviewResult {
    mapped_columns: MappedColumns;
    date_format: string | null;
    // 5-tuple: (customer_id, date_iso, amount, currency, category) — matches Rust tuple serialization
    sample_normalized: [string, string, number, string, string][];
}

export interface ValidationError {
    row_number: number;
    reason: string;
}

export async function importPreview(filePath: string): Promise<PreviewResult> {
    return await invokeWorkspace<PreviewResult>('import_preview', { file_path: filePath });
}

export async function importCommit(filePath: string): Promise<number> {
    return await invokeWorkspace<number>('import_commit', { file_path: filePath });
}

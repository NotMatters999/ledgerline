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
    // total non-blank parseable rows in the full file — used for the confirm button label
    total_rows: number;
}

export interface ValidationError {
    row_number: number;
    reason: string;
}

/** Returned by importCommit — breakdown of newly inserted vs. overwritten rows. */
export interface ImportResult {
    inserted: number;
    updated: number;
}

export async function importPreview(filePath: string): Promise<PreviewResult> {
    return await invokeWorkspace<PreviewResult>('import_preview', { filePath });
}

export async function importCommit(filePath: string): Promise<ImportResult> {
    return await invokeWorkspace<ImportResult>('import_commit', { filePath });
}

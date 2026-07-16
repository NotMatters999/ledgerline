import { invoke } from '@tauri-apps/api/core';

export interface CsvExportResult {
    mrr_csv: string;
    retention_csv: string;
    cohorts_csv: string;
}

export async function exportCsv(workspaceId: string): Promise<CsvExportResult> {
    return await invoke<CsvExportResult>('export_csv', { workspaceId });
}

export async function exportPdf(workspaceId: string): Promise<number[]> {
    return await invoke<number[]>('export_pdf', { workspaceId });
}

export function downloadBlob(content: string | Uint8Array, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

import { invoke } from '@tauri-apps/api/core';

export interface CsvExportResult {
    mrr_csv: string;
    retention_csv: string;
    cohorts_csv: string;
}

export async function exportCsv(workspaceId: string): Promise<CsvExportResult> {
    return await invoke<CsvExportResult>('export_csv', { workspace_id: workspaceId });
}

export async function exportPdf(workspaceId: string): Promise<number[]> {
    return await invoke<number[]>('export_pdf', { workspace_id: workspaceId });
}

export function downloadBlob(content: string | Uint8Array | number[], filename: string, mimeType: string) {
    let finalContent = content;
    if (mimeType === 'application/pdf' && Array.isArray(content)) {
        finalContent = new Uint8Array(content);
    }
    const blob = new Blob([finalContent], { type: mimeType });
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

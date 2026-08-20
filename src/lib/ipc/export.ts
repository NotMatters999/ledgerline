import { invokeWorkspace } from './client';

export interface CsvExportResult {
    mrr_csv: string;
    retention_csv: string;
    cohorts_csv: string;
}

export async function exportCsv(): Promise<CsvExportResult> {
    return await invokeWorkspace<CsvExportResult>('csv_export');
}

export async function exportPdf(): Promise<number[]> {
    return await invokeWorkspace<number[]>('pdf_export');
}

export function downloadBlob(content: string | Uint8Array | number[], filename: string, mimeType: string) {
    let finalContent: string | Uint8Array;
    if (Array.isArray(content)) {
        finalContent = new Uint8Array(content);
    } else {
        finalContent = content;
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

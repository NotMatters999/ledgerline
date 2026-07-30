/**
 * Maps raw backend/IPC errors to user-friendly messages.
 * We specifically ignore empty state conditions here because empty states 
 * (like "No data available") are not errors; they are handled via conditional rendering.
 */
export function mapBackendError(error: unknown): string | null {
    if (!error) return null;
    const msg = String(error);

    // Ignore empty state conditions - they are not errors
    if (msg.toLowerCase().includes('no data') || msg.toLowerCase().includes('empty')) {
        return null;
    }

    // Common network or IPC failures
    if (msg.includes('failed to setup connection') || msg.includes('IPC')) {
        return 'Connection to the local backend lost. Please restart LedgerLine.';
    }

    // SQLite/DuckDB errors
    if (msg.includes('UNIQUE constraint failed')) {
        return 'A record with this identifier already exists.';
    }
    if (msg.includes('no such table')) {
        return 'Database structure is missing or corrupt. You may need to create a new workspace.';
    }
    if (msg.includes('Could not parse date')) {
        return 'One or more dates in your file are improperly formatted. Please use a recognized format (e.g. YYYY-MM-DD).';
    }

    // Default fallback
    return `An unexpected error occurred: ${msg}`;
}

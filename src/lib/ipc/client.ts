import { invoke as tauriInvoke, InvokeArgs } from '@tauri-apps/api/core';
import { useWorkspaceStore } from '../../store/workspace';

/**
 * Standard Tauri invoke. Does not inject workspace ID.
 * Use for global commands or workspace registry commands.
 */
export async function invoke<T>(cmd: string, args: InvokeArgs = {}): Promise<T> {
    return tauriInvoke<T>(cmd, args);
}

/**
 * Invokes a backend command and automatically injects the active `workspace_id`.
 * Use this ONLY for data-level backend commands that operate on the active workspace.
 */
export async function invokeWorkspace<T>(cmd: string, args: InvokeArgs = {}): Promise<T> {
    const activeId = useWorkspaceStore.getState().activeId;
    if (!activeId) {
        throw new Error("No active workspace selected.");
    }
    const finalArgs = { ...args, workspace_id: activeId };
    return tauriInvoke<T>(cmd, finalArgs);
}

import { create } from 'zustand';
import {
    listWorkspaces, createWorkspace, renameWorkspace,
    switchWorkspace, requestDeleteWorkspace, confirmDeleteWorkspace,
    Workspace,
} from '../lib/ipc/workspace';

interface WorkspaceState {
    workspaces: Workspace[];
    activeId: string;
    isLoading: boolean;
    error: string | null;
    load: () => Promise<void>;
    create: (name: string) => Promise<void>;
    rename: (id: string, name: string) => Promise<void>;
    remove: (id: string) => Promise<void>;
    switchTo: (id: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
    workspaces: [],
    activeId: '',
    isLoading: false,
    error: null,

    load: async () => {
        set({ isLoading: true, error: null });
        try {
            const workspaces = await listWorkspaces();
            // Sort by last_accessed descending so most-recently-used is first / active
            const sorted = [...workspaces].sort(
                (a, b) => new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime()
            );
            const activeId = sorted.length > 0 ? sorted[0].id : '';
            set({ workspaces: sorted, activeId, isLoading: false });
        } catch (e: unknown) {
            set({ error: String(e), isLoading: false });
        }
    },

    create: async (name: string) => {
        const ws = await createWorkspace(name);
        set(state => ({
            workspaces: [...state.workspaces, ws],
            activeId: ws.id, // auto-switch to the new workspace
        }));
    },

    rename: async (id: string, name: string) => {
        const updated = await renameWorkspace(id, name);
        set(state => ({
            workspaces: state.workspaces.map(w => (w.id === id ? updated : w)),
        }));
    },

    remove: async (id: string) => {
        const token = await requestDeleteWorkspace(id);
        await confirmDeleteWorkspace(token);
        set(state => {
            const remaining = state.workspaces.filter(w => w.id !== id);
            const activeId =
                state.activeId === id
                    ? remaining.length > 0
                        ? remaining[0].id
                        : ''
                    : state.activeId;
            return { workspaces: remaining, activeId };
        });
    },

    switchTo: async (id: string) => {
        await switchWorkspace(id);
        set({ activeId: id });
    },
}));

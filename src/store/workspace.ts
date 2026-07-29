import { create } from 'zustand';
import {
    listWorkspaces, createWorkspace, renameWorkspace,
    switchWorkspace, requestDeleteWorkspace, confirmDeleteWorkspace,
    Workspace,
} from '../lib/ipc/workspace';
import { useFinancialsStore } from './financials';
import { useCohortStore } from './cohort';

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

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
    workspaces: [],
    activeId: '',
    isLoading: false,
    error: null,

    load: async () => {
        set({ isLoading: true, error: null });
        try {
            const workspaces = await listWorkspaces();
            const sorted = [...workspaces].sort(
                (a, b) => new Date(b.last_accessed).getTime() - new Date(a.last_accessed).getTime()
            );
            const activeId = sorted.length > 0 ? sorted[0].id : '';
            if (activeId) {
                await switchWorkspace(activeId);
            }
            set({ workspaces: sorted, activeId, isLoading: false });
        } catch (e: unknown) {
            set({ error: String(e), isLoading: false });
        }
    },

    create: async (name: string) => {
        const ws = await createWorkspace(name);
        await switchWorkspace(ws.id);
        set(state => ({
            workspaces: [...state.workspaces, ws],
            activeId: ws.id,
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
        await confirmDeleteWorkspace(id, token);
        const state = get();
        const remaining = state.workspaces.filter(w => w.id !== id);
        let newActiveId = state.activeId;
        if (state.activeId === id) {
            newActiveId = remaining.length > 0 ? remaining[0].id : '';
            if (newActiveId) {
                await switchWorkspace(newActiveId);
            } else {
                useFinancialsStore.getState().clear();
                useCohortStore.getState().clear();
            }
        }
        set({ workspaces: remaining, activeId: newActiveId });
    },

    switchTo: async (id: string) => {
        await switchWorkspace(id);
        set({ activeId: id });
    },
}));

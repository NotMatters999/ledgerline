import { create } from 'zustand';
import { getCohort, CohortData } from '../lib/ipc/engines';

interface CohortState {
    isLoading: boolean;
    error: string | null;
    data: CohortData | null;
    fetchData: () => Promise<void>;
    clear: () => void;
}

export const useCohortStore = create<CohortState>((set) => ({
    isLoading: false,
    error: null,
    data: null,

    fetchData: async () => {
        set({ isLoading: true, error: null });
        try {
            const data = await getCohort();
            set({ data, isLoading: false });
        } catch (error: any) {
            set({ error: error instanceof Error ? error.message : (typeof error === 'string' ? error : (JSON.stringify(error) || String(error))), isLoading: false });
        }
    },
    
    clear: () => set({ data: null, error: null, isLoading: false })
}));
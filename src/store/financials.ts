import { create } from 'zustand';
import {
    getMrr, getArr, getRetention, getLtv, getCac, getPayback,
    MrrMovement, ArrMovement, RetentionMovement, LtvMovement, CacMovement, PaybackMovement
} from '../lib/ipc/engines';

interface FinancialsState {
    isLoading: boolean;
    error: string | null;
    
    mrr: MrrMovement[];
    arr: ArrMovement[];
    retention: RetentionMovement[];
    ltv: LtvMovement[];
    cac: CacMovement[];
    payback: PaybackMovement[];

    fetchData: (workspaceId: string) => Promise<void>;
    clear: () => void;
}

export const useFinancialsStore = create<FinancialsState>((set) => ({
    isLoading: false,
    error: null,
    
    mrr: [],
    arr: [],
    retention: [],
    ltv: [],
    cac: [],
    payback: [],

    fetchData: async (workspaceId: string) => {
        set({ isLoading: true, error: null });
        try {
            // Parallel fetch to respect Section 10 IPC single-responsibility rule
            const [mrr, arr, retention, ltv, cac, payback] = await Promise.all([
                getMrr(workspaceId),
                getArr(workspaceId),
                getRetention(workspaceId),
                getLtv(workspaceId),
                getCac(workspaceId),
                getPayback(workspaceId),
            ]);
            
            set({
                mrr,
                arr,
                retention,
                ltv,
                cac,
                payback,
                isLoading: false
            });
        } catch (error: any) {
            set({ error: error.toString(), isLoading: false });
        }
    },

    clear: () => set({ mrr: [], arr: [], retention: [], ltv: [], cac: [], payback: [], error: null, isLoading: false })
}));

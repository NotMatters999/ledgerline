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

    fetchData: () => Promise<void>;
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

    fetchData: async () => {
        set({ isLoading: true, error: null });
        try {
            // Sequential — not Promise.all — because each command opens its own
            // DuckDB connection. Concurrent opens on the same .duckdb file fail
            // with an exclusive-lock error on DuckDB community edition.
            const mrr       = await getMrr();
            const arr       = await getArr();
            const retention = await getRetention();
            const ltv       = await getLtv();
            const cac       = await getCac();
            const payback   = await getPayback();
            
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
            set({ error: error instanceof Error ? error.message : (typeof error === 'string' ? error : (JSON.stringify(error) || String(error))), isLoading: false });
        }
    },

    clear: () => set({ mrr: [], arr: [], retention: [], ltv: [], cac: [], payback: [], error: null, isLoading: false })
}));

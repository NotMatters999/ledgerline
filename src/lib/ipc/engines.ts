import { invoke } from '@tauri-apps/api/core';

export interface MrrMovement {
    month: string;
    beginning: number;
    new: number;
    expansion: number;
    reactivation: number;
    contraction: number;
    churn: number;
    net_new: number;
    ending: number;
    beginning_customers: number;
    new_customers: number;
    churned_customers: number;
    ending_customers: number;
}

export interface ArrMovement {
    month: string;
    arr: number;
}

export interface RetentionMovement {
    month: string;
    grr: number | null;
    nrr: number | null;
    logo_retention: number | null;
}

export interface LtvMovement {
    month: string;
    ltv: number | null;
    arpa: number;
    gross_margin: number;
    churn_rate: number;
}

export interface CacMovement {
    month: string;
    marketing_spend: number;
    cac: number | null;
}

export interface PaybackMovement {
    month: string;
    payback_months: number | null;
}

export interface ForecastParams {
    monthly_churn_rate: number;
    monthly_expansion_rate: number;
    new_mrr_per_month: number;
}

export interface ForecastMovement {
    month: string;
    beginning: number;
    churn: number;
    expansion: number;
    new: number;
    ending: number;
}

export interface CohortCell {
    month_index: number;
    retained_customers: number;
    retained_revenue: number;
}

export interface CohortRow {
    join_month: string;
    new_customers: number;
    new_revenue: number;
    data: CohortCell[];
}

export interface CohortData {
    rows: CohortRow[];
}

export async function getMrr(workspaceId: string): Promise<MrrMovement[]> {
    return await invoke<MrrMovement[]>('mrr_get', { workspaceId });
}

export async function getArr(workspaceId: string): Promise<ArrMovement[]> {
    return await invoke<ArrMovement[]>('arr_get', { workspaceId });
}

export async function getRetention(workspaceId: string): Promise<RetentionMovement[]> {
    return await invoke<RetentionMovement[]>('retention_get', { workspaceId });
}

export async function getLtv(workspaceId: string): Promise<LtvMovement[]> {
    return await invoke<LtvMovement[]>('ltv_get', { workspaceId });
}

export async function getCac(workspaceId: string): Promise<CacMovement[]> {
    return await invoke<CacMovement[]>('cac_get', { workspaceId });
}

export async function getPayback(workspaceId: string): Promise<PaybackMovement[]> {
    return await invoke<PaybackMovement[]>('payback_get', { workspaceId });
}

export async function getForecast(workspaceId: string, params: ForecastParams): Promise<ForecastMovement[]> {
    return await invoke<ForecastMovement[]>('forecast_get', { workspaceId, params });
}

export async function getCohort(workspaceId: string): Promise<CohortData> {
    return await invoke<CohortData>('cohort_get', { workspaceId });
}

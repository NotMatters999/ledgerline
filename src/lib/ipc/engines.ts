import { invokeWorkspace } from './client';

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

export async function getMrr(): Promise<MrrMovement[]> {
    return await invokeWorkspace<MrrMovement[]>('mrr_get');
}

export async function getArr(): Promise<ArrMovement[]> {
    return await invokeWorkspace<ArrMovement[]>('arr_get');
}

export async function getRetention(): Promise<RetentionMovement[]> {
    return await invokeWorkspace<RetentionMovement[]>('retention_get');
}

export async function getLtv(): Promise<LtvMovement[]> {
    return await invokeWorkspace<LtvMovement[]>('ltv_get');
}

export async function getCac(): Promise<CacMovement[]> {
    return await invokeWorkspace<CacMovement[]>('cac_get');
}

export async function getPayback(): Promise<PaybackMovement[]> {
    return await invokeWorkspace<PaybackMovement[]>('payback_get');
}

export async function getForecast(params: ForecastParams): Promise<ForecastMovement[]> {
    return await invokeWorkspace<ForecastMovement[]>('forecast_get', { params });
}

export async function getCohort(): Promise<CohortData> {
    return await invokeWorkspace<CohortData>('cohort_get');
}

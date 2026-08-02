import { MrrMovement } from '../lib/ipc/engines';

export interface WaterfallPayload {
    categories: string[];
    base: number[];
    value: number[];
    colors: string[];
    isTotal: boolean[];
}

export function computeWaterfall(movement: MrrMovement): WaterfallPayload {
    const categories = [
        'Beginning',
        'New',
        'Expansion',
        'Reactivation',
        'Contraction',
        'Churn',
        'Ending'
    ];

    const amounts = [
        movement.beginning,
        movement.new,
        movement.expansion,
        movement.reactivation,
        -movement.contraction, // Contraction is an absolute value in the API, we subtract it
        -movement.churn,       // Churn is absolute, we subtract it
        0 // Placeholder for Ending, computed separately
    ];

    const base: number[] = [];
    const value: number[] = [];
    const colors: string[] = [];
    const isTotal: boolean[] = [];

    const COLOR_TOTAL = '#60A5FA'; // Blue 400
    const COLOR_POS = '#34D399';   // Emerald 400
    const COLOR_NEG = '#F43F5E';   // Rose 500

    let currentTotal = 0;

    for (let i = 0; i < categories.length; i++) {
        if (i === 0) {
            // Beginning is a total column
            base.push(0);
            value.push(amounts[i]);
            colors.push(COLOR_TOTAL);
            isTotal.push(true);
            currentTotal += amounts[i];
        } else if (i === categories.length - 1) {
            // Ending is a total column — base is 0, height is the running total
            base.push(0);
            value.push(currentTotal);
            colors.push(COLOR_TOTAL);
            isTotal.push(true); // ← was missing: caused isTotal array to be length 6 vs 7
        } else {
            const amount = amounts[i];
            isTotal.push(false);
            if (amount >= 0) {
                base.push(currentTotal);
                value.push(amount);
                colors.push(COLOR_POS);
                currentTotal += amount;
            } else {
                // For negative amounts, the base drops and the value fills the gap
                currentTotal += amount; // amount is negative
                base.push(currentTotal);
                value.push(-amount);
                colors.push(COLOR_NEG);
            }
        }
    }

    return { categories, base, value, colors, isTotal };
}

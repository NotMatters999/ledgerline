import { computeWaterfall } from './waterfall';
import { MrrMovement } from '../lib/ipc/engines';

function runTests() {
    console.log("Running waterfall tests...");

    // Mock movement based on Phase 5 dataset (e.g. Month 2: Mar 2024)
    // Jan: A(100), B(50) -> End 150
    // Feb: A(150), B(50), C(200) -> End 400 (Beg: 150, Exp: 50, New: 200)
    // Mar: Beg(400), Churn A(150), Contract B(25) -> End 225

    const mockMovement: MrrMovement = {
        month: "2024-03-01",
        beginning: 400.0,
        new: 0.0,
        expansion: 0.0,
        reactivation: 0.0,
        contraction: 25.0,
        churn: 150.0,
        net_new: -175.0,
        ending: 225.0,
        beginning_customers: 3,
        new_customers: 0,
        churned_customers: 1,
        ending_customers: 2
    };

    const payload = computeWaterfall(mockMovement);

    // Assert Categories length
    if (payload.categories.length !== 7) throw new Error("Categories length mismatch");
    if (payload.base.length !== 7) throw new Error("Base length mismatch");
    if (payload.value.length !== 7) throw new Error("Value length mismatch");

    // 0: Beginning
    if (payload.base[0] !== 0) throw new Error("Beginning base should be 0");
    if (payload.value[0] !== 400) throw new Error("Beginning value should be 400");

    // 1: New (0)
    if (payload.base[1] !== 400) throw new Error("New base should be 400");
    if (payload.value[1] !== 0) throw new Error("New value should be 0");

    // 2: Expansion (0)
    if (payload.base[2] !== 400) throw new Error("Expansion base should be 400");
    if (payload.value[2] !== 0) throw new Error("Expansion value should be 0");

    // 3: Reactivation (0)
    if (payload.base[3] !== 400) throw new Error("Reactivation base should be 400");
    if (payload.value[3] !== 0) throw new Error("Reactivation value should be 0");

    // 4: Contraction (25 negative)
    // Current total was 400. Drop by 25 -> 375.
    // Base should be 375, value should be 25.
    if (payload.base[4] !== 375) throw new Error(`Contraction base wrong: ${payload.base[4]}`);
    if (payload.value[4] !== 25) throw new Error(`Contraction value wrong: ${payload.value[4]}`);

    // 5: Churn (150 negative)
    // Current total was 375. Drop by 150 -> 225.
    // Base should be 225, value should be 150.
    if (payload.base[5] !== 225) throw new Error(`Churn base wrong: ${payload.base[5]}`);
    if (payload.value[5] !== 150) throw new Error(`Churn value wrong: ${payload.value[5]}`);

    // 6: Ending (Total column)
    if (payload.base[6] !== 0) throw new Error("Ending base should be 0");
    if (payload.value[6] !== 225) throw new Error(`Ending value wrong, expected 225 got ${payload.value[6]}`);
    
    // Also explicitly test reconciliation logic
    const computedEnding = 
        mockMovement.beginning + 
        mockMovement.new + 
        mockMovement.expansion + 
        mockMovement.reactivation - 
        mockMovement.contraction - 
        mockMovement.churn;
        
    if (computedEnding !== payload.value[6]) {
        throw new Error(`Reconciliation failed: computed ${computedEnding}, ending value ${payload.value[6]}`);
    }

    console.log("All waterfall tests passed successfully!");
}

// Simple runner for ts-node / tsx if executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runTests();
}

export { runTests };

use duckdb::Connection;
use ledgerline_lib::db::migrations::run_migrations;
use ledgerline_lib::engines::mrr::calculate_mrr;
use ledgerline_lib::engines::ltv::calculate_ltv;
use ledgerline_lib::engines::cac::calculate_cac;

#[test]
fn test_end_to_end_ledgerline_pipeline() {
    let mut conn = Connection::open_in_memory().unwrap();
    
    // 1. Run Migrations (which creates V2 schema)
    run_migrations(&mut conn).expect("Failed to run migrations");

    // 2. Insert messy MRR data simulating an import
    // Note: C churns in Feb, returns in April (>1 month gap) -> Reactivation
    // A churns in Feb, returns in March (1 month gap) -> Expansion
    conn.execute_batch(include_str!("fixtures/e2e_mrr_setup.sql")).unwrap();

    // 3. Insert Unit Economics Assumptions
    conn.execute_batch(include_str!("fixtures/e2e_assumptions_setup.sql")).unwrap();

    // 4. Calculate MRR
    let mrr = calculate_mrr(&conn).unwrap();
    assert_eq!(mrr.len(), 4);

    let jan = &mrr[0];
    assert_eq!(jan.new, 250.0);
    assert_eq!(jan.ending_customers, 3);

    let feb = &mrr[1];
    assert_eq!(feb.churn, 150.0); // A and C churned

    let mar = &mrr[2];
    assert_eq!(mar.expansion, 150.0); // A returned after exactly 1 month gap (1-month gap logic)

    let apr = &mrr[3];
    assert_eq!(apr.reactivation, 100.0); // C returned after 2 months (Feb, Mar gap -> Reactivation)

    // 5. Calculate LTV / CAC
    let cac = calculate_cac(&conn).unwrap();
    assert_eq!(cac.len(), 4);
    assert_eq!(cac[0].marketing_spend, 1000.0);

    let ltv = calculate_ltv(&conn).unwrap();
    assert_eq!(ltv.len(), 4);
    
    // In Jan, margin is 0.8
    assert_eq!(ltv[0].gross_margin, 0.8);
    // In Feb, margin is 0.85
    assert_eq!(ltv[1].gross_margin, 0.85);
}

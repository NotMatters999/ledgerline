#[cfg(test)]
mod tests {
    use duckdb::Connection;
    use crate::engines::mrr::calculate_mrr;
    use crate::engines::arr::calculate_arr;
    use crate::engines::retention::calculate_retention;
    use crate::engines::ltv::calculate_ltv;
    use crate::engines::cac::calculate_cac;
    use crate::engines::payback::calculate_payback;
    use crate::engines::forecast::{calculate_forecast, ForecastParams};
    use crate::engines::cohort::calculate_cohorts;

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        
        // Setup schema
        conn.execute_batch(
            "CREATE TABLE mrr_log (customer_id VARCHAR, period DATE, mrr_amount DOUBLE, currency VARCHAR);
             CREATE TABLE marketing_spend (period DATE, amount DOUBLE, channel VARCHAR);
             CREATE TABLE settings (key VARCHAR, value VARCHAR);"
        ).unwrap();

        // Insert settings
        conn.execute("INSERT INTO settings VALUES ('gross_margin', '0.80')", []).unwrap();

        // Insert marketing spend
        conn.execute_batch(
            "INSERT INTO marketing_spend VALUES ('2024-01-15', 1000.0, 'Google');
             INSERT INTO marketing_spend VALUES ('2024-02-15', 500.0, 'Google');
             INSERT INTO marketing_spend VALUES ('2024-03-15', 500.0, 'Google');"
        ).unwrap();

        // Insert MRR log
        // Cust A: New in Jan(100), Expands in Feb(150), Churns in Mar(0)
        // Cust B: New in Jan(50), Flat in Feb(50), Contracts in Mar(25)
        // Cust C: New in Feb(200), Flat in Mar(200)
        conn.execute_batch(
            "INSERT INTO mrr_log VALUES ('A', '2024-01-01', 100, 'USD');
             INSERT INTO mrr_log VALUES ('B', '2024-01-01', 50, 'USD');
             
             INSERT INTO mrr_log VALUES ('A', '2024-02-01', 150, 'USD');
             INSERT INTO mrr_log VALUES ('B', '2024-02-01', 50, 'USD');
             INSERT INTO mrr_log VALUES ('C', '2024-02-01', 200, 'USD');

             INSERT INTO mrr_log VALUES ('A', '2024-03-01', 0, 'USD');
             INSERT INTO mrr_log VALUES ('B', '2024-03-01', 25, 'USD');
             INSERT INTO mrr_log VALUES ('C', '2024-03-01', 200, 'USD');
             "
        ).unwrap();
        
        conn
    }

    #[test]
    fn test_mrr_movements() {
        let conn = setup_db();
        let mrr = calculate_mrr(&conn).unwrap();
        
        assert_eq!(mrr.len(), 3);
        
        // Jan: A(100) + B(50) = 150 New
        assert_eq!(mrr[0].month, "2024-01-01");
        assert_eq!(mrr[0].new, 150.0);
        assert_eq!(mrr[0].ending, 150.0);
        assert_eq!(mrr[0].new_customers, 2);

        // Feb: Beg(150) + Exp A(50) + New C(200) = 400 Ending
        assert_eq!(mrr[1].month, "2024-02-01");
        assert_eq!(mrr[1].beginning, 150.0);
        assert_eq!(mrr[1].expansion, 50.0);
        assert_eq!(mrr[1].new, 200.0);
        assert_eq!(mrr[1].ending, 400.0);
        assert_eq!(mrr[1].new_customers, 1);

        // Mar: Beg(400) + Churn A(150) + Contract B(25) = 225 Ending
        assert_eq!(mrr[2].month, "2024-03-01");
        assert_eq!(mrr[2].beginning, 400.0);
        assert_eq!(mrr[2].churn, 150.0);
        assert_eq!(mrr[2].contraction, 25.0);
        assert_eq!(mrr[2].ending, 225.0);
        assert_eq!(mrr[2].churned_customers, 1);
    }

    #[test]
    fn test_retention() {
        let conn = setup_db();
        let ret = calculate_retention(&conn).unwrap();

        // Mar GRR = (400 - 150 churn - 25 contraction) / 400 = 225/400 = 0.5625
        assert_eq!(ret[2].grr, 0.5625);
        // Mar Logo Retention = (3 - 1) / 3 = 0.666
        assert_eq!(ret[2].logo_retention, 2.0/3.0);
    }

    #[test]
    fn test_cac_ltv_payback() {
        let conn = setup_db();
        let cac = calculate_cac(&conn).unwrap();
        
        // Jan CAC = 1000 spend / 2 new = 500
        assert_eq!(cac[0].cac, 500.0);
        // Feb CAC = 500 spend / 1 new = 500
        assert_eq!(cac[1].cac, 500.0);

        let ltv = calculate_ltv(&conn).unwrap();
        // Mar ARPA = 225 / 2 = 112.5
        assert_eq!(ltv[2].arpa, 112.5);
        // Mar Churn Rate = 1 churned / 3 beginning = 0.333
        assert_eq!(ltv[2].churn_rate, 1.0/3.0);
        // Mar LTV = (112.5 * 0.8) / 0.333 = 270.0
        assert_eq!(ltv[2].ltv, 270.0);

        let payback = calculate_payback(&conn).unwrap();
        // Mar Payback = 500 (since Mar CAC is 500/0=0 wait, Mar new=0, so CAC=0?)
        // Wait, Mar spend=500, new=0, CAC=0? The cac.rs says: cac = spend/new, if new>0 else 0.
        // So Mar CAC = 0. Payback = 0.
        assert_eq!(payback[2].payback_months, 0.0);
    }

    #[test]
    fn test_forecast_performance() {
        let conn = setup_db();
        let params = ForecastParams {
            monthly_churn_rate: 0.02,
            monthly_expansion_rate: 0.05,
            new_mrr_per_month: 1000.0,
        };
        
        let start = std::time::Instant::now();
        let forecast = calculate_forecast(&conn, &params).unwrap();
        let duration = start.elapsed();
        
        assert!(duration.as_millis() < 200, "Forecast took {}ms, budget is < 200ms", duration.as_millis());
        assert_eq!(forecast.len(), 12);
        
        // Baseline ending is 225
        // Month 1: 225 - (225*0.02) + (225*0.05) + 1000 = 225 - 4.5 + 11.25 + 1000 = 1231.75
        assert_eq!(forecast[0].beginning, 225.0);
        assert_eq!(forecast[0].ending, 1231.75);
    }

    #[test]
    fn test_cohorts() {
        let conn = setup_db();
        let cohort_data = calculate_cohorts(&conn).unwrap();

        assert_eq!(cohort_data.rows.len(), 2); // Jan cohort, Feb cohort
        
        let jan_cohort = &cohort_data.rows[0];
        assert_eq!(jan_cohort.join_month, "2024-01-01");
        assert_eq!(jan_cohort.new_customers, 2);
        assert_eq!(jan_cohort.new_revenue, 150.0);
        
        // Month 0 (Jan)
        assert_eq!(jan_cohort.data[0].retained_customers, 2);
        assert_eq!(jan_cohort.data[0].retained_revenue, 150.0);
        // Month 1 (Feb) -> A(150), B(50) -> 2 cust, 200 rev
        assert_eq!(jan_cohort.data[1].retained_customers, 2);
        assert_eq!(jan_cohort.data[1].retained_revenue, 200.0);
        // Month 2 (Mar) -> A(0), B(25) -> 1 cust, 25 rev
        assert_eq!(jan_cohort.data[2].retained_customers, 1);
        assert_eq!(jan_cohort.data[2].retained_revenue, 25.0);

        let feb_cohort = &cohort_data.rows[1];
        assert_eq!(feb_cohort.join_month, "2024-02-01");
        assert_eq!(feb_cohort.new_customers, 1);
        // Month 0 (Feb) -> C(200)
        // Month 1 (Mar) -> C(200)
        assert_eq!(feb_cohort.data[1].retained_revenue, 200.0);
    }
}

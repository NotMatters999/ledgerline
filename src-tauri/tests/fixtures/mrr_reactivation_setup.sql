-- Jan: A($100), B($100) → New:200, Ending:200
INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('A', '2024-01-01', 100.0, 'USD');
INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('B', '2024-01-01', 100.0, 'USD');

-- Feb: A churns. B expands($150). C is new($50).
-- Beginning:200, Churn:100, Expansion:50, New:50, Ending:200
INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('B', '2024-02-01', 150.0, 'USD');
INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('C', '2024-02-01', 50.0, 'USD');

-- Mar: A returns exactly 1 month later (gap=2 months from Jan to Mar, diff_months<=2) → Expansion
--      B stays($150). C churns.
-- Beginning:200, Expansion:100 (A), Churn:50 (C), Ending:250
INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('A', '2024-03-01', 100.0, 'USD');
INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('B', '2024-03-01', 150.0, 'USD');

-- Apr: C returns after 2 months gap (Feb→Apr: diff_months=2, which is <=2 in code)
--      B contracts($100). A stays($100).
-- Wait: in mrr.rs: diff_months <= 2 is Expansion, > 2 is Reactivation
-- C last active was Feb. Apr - Feb = 2 months. That means diff_months=2 → Expansion (<=2).
-- So for actual Reactivation, we need diff_months > 2 i.e. a customer absent for 3+ months.
-- Let's add E that was in Jan, absent Feb+Mar, returns in Apr → diff=3 → Reactivation.
INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('A', '2024-04-01', 100.0, 'USD');
INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('B', '2024-04-01', 100.0, 'USD');
INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('C', '2024-04-01', 50.0, 'USD');
INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('E', '2024-01-01', 80.0, 'USD');
INSERT INTO mrr_log (customer_id, period, mrr_amount, currency) VALUES ('E', '2024-04-01', 80.0, 'USD');

-- monthly_assumptions for CAC/LTV assertions
INSERT INTO monthly_assumptions (month, marketing_spend, gross_margin) VALUES ('2024-01', 1000.0, 0.8);
INSERT INTO monthly_assumptions (month, marketing_spend, gross_margin) VALUES ('2024-02', 500.0, 0.85);
INSERT INTO monthly_assumptions (month, marketing_spend, gross_margin) VALUES ('2024-03', 1500.0, 0.9);
INSERT INTO monthly_assumptions (month, marketing_spend, gross_margin) VALUES ('2024-04', 2000.0, 0.9);

-- Migration 5: per-currency exchange rates table.
-- Each row maps a currency code (e.g. 'GBP') to a multiplier relative to the
-- workspace's base/reporting currency.  For the base currency itself the rate
-- is 1.0.  When a currency has no row, the MRR engine defaults to 1.0
-- (i.e. amounts are passed through unchanged), which preserves backwards
-- compatibility for workspaces that only ever use a single currency.
CREATE TABLE IF NOT EXISTS exchange_rates (
    currency     VARCHAR PRIMARY KEY,
    rate_to_base DOUBLE  NOT NULL CHECK (rate_to_base > 0),
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

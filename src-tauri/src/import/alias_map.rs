use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct MappedColumns {
    pub customer_id_idx: Option<usize>,
    pub revenue_idx:     Option<usize>,
    pub date_idx:        Option<usize>,
    pub currency_idx:    Option<usize>,
    pub category_idx:    Option<usize>,
    pub other_cols:      Vec<usize>,
}

impl MappedColumns {
    pub fn is_complete(&self) -> bool {
        self.customer_id_idx.is_some()
            && self.revenue_idx.is_some()
            && self.date_idx.is_some()
    }
}

pub fn detect_columns(headers: &[String]) -> MappedColumns {
    // ── Alias tables ───────────────────────────────────────────────────────
    // All strings are lowercase with spaces/dashes already normalised to '_'
    // before comparison (see the loop below).  Add variants here, not there.

    let customer_aliases = [
        // original
        "customer_id", "customer", "account", "account_id", "company",
        // additions — common export-tool / CRM header names
        "client", "client_id", "org", "organization",
        "user_id", "user",
    ];

    let revenue_aliases = [
        // original
        "mrr",
        "mrr_amount",
        "mrr_value",
        "revenue",
        "amount",
        "monthly_revenue",
        "revenue_amount",
        "net_revenue",
        "arr",
        "subscription",
        "subscription_revenue",
        "recurring_revenue",
        // additions
        "charge",
        "fee",
        "billing_amount",
        "monthly_amount",
        "value",
        "total",
        "total_amount",
    ];

    let date_aliases = [
        // original
        "date", "month", "period", "invoice_date",
        // additions
        "billing_date",
        "transaction_date",
        "start_date",
        "reporting_period",
        "month_year",
        "year_month",
    ];

    let currency_aliases = [
        // original
        "currency", "curr", "iso", "currency_code",
        // additions
        "ccy", "fx",
    ];

    let category_aliases = [
        // original
        "category", "plan", "tier", "product", "subscription_type",
        // additions
        "type",
        "package",
        "level",
        "segment",
        "group",
    ];

    let mut mapped = MappedColumns {
        customer_id_idx: None,
        revenue_idx:     None,
        date_idx:        None,
        currency_idx:    None,
        category_idx:    None,
        other_cols:      Vec::new(),
    };

    for (i, header) in headers.iter().enumerate() {
        // Normalise: lowercase, collapse spaces and dashes to underscores
        let clean = header.trim().to_lowercase().replace([' ', '-'], "_");

        if mapped.customer_id_idx.is_none() && customer_aliases.contains(&clean.as_str()) {
            mapped.customer_id_idx = Some(i);
        } else if mapped.revenue_idx.is_none() && revenue_aliases.contains(&clean.as_str()) {
            mapped.revenue_idx = Some(i);
        } else if mapped.date_idx.is_none() && date_aliases.contains(&clean.as_str()) {
            mapped.date_idx = Some(i);
        } else if mapped.currency_idx.is_none() && currency_aliases.contains(&clean.as_str()) {
            mapped.currency_idx = Some(i);
        } else if mapped.category_idx.is_none() && category_aliases.contains(&clean.as_str()) {
            mapped.category_idx = Some(i);
        } else {
            mapped.other_cols.push(i);
        }
    }

    mapped
}

use serde::Serialize;



#[derive(Debug, Clone, Serialize)]
pub struct MappedColumns {
    pub customer_id_idx: Option<usize>,
    pub revenue_idx: Option<usize>,
    pub date_idx: Option<usize>,
    pub currency_idx: Option<usize>,
    pub category_idx: Option<usize>,
    pub other_cols: Vec<usize>,
}

impl MappedColumns {
    pub fn is_complete(&self) -> bool {
        self.customer_id_idx.is_some() && self.revenue_idx.is_some() && self.date_idx.is_some()
    }
}

pub fn detect_columns(headers: &[String]) -> MappedColumns {
    let customer_aliases = ["customer_id", "customer", "account", "account_id", "company"];
    let revenue_aliases = ["mrr", "revenue", "amount", "subscription"];
    let date_aliases = ["date", "month", "period", "invoice_date"];
    let currency_aliases = ["currency", "curr", "iso", "currency_code"];
    let category_aliases = ["category", "plan", "tier", "product", "subscription_type"];

    let mut mapped = MappedColumns {
        customer_id_idx: None,
        revenue_idx: None,
        date_idx: None,
        currency_idx: None,
        category_idx: None,
        other_cols: Vec::new(),
    };

    for (i, header) in headers.iter().enumerate() {
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

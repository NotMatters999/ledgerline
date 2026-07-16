pub mod mrr;
pub mod arr;
pub mod retention;
pub mod ltv;
pub mod cac;
pub mod payback;
pub mod forecast;
pub mod cohort;

#[cfg(test)]
mod tests;

use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeriodRange {
    pub start_date: String,
    pub end_date: String,
}

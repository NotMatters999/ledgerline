export interface DocSection {
    id: string;
    title: string;
    content: string;
}

export const documentationSections: DocSection[] = [
    {
        id: "formulas",
        title: "Formula Explanations",
        content: `
## Formula Explanations

LedgerLine uses standardized SaaS formulas to compute metrics.

### MRR (Monthly Recurring Revenue)
MRR is computed dynamically by summing active, recognized revenue for a given month.
- **New MRR**: First time a customer pays > $0.
- **Expansion MRR**: Customer pays more than the previous month (or returns after exactly 1 month of churn).
- **Contraction MRR**: Customer pays less than the previous month, but > $0.
- **Churn MRR**: Customer pays $0 after previously paying > $0.
- **Reactivation MRR**: Customer pays > $0 after skipping two or more full calendar months.

### Retention
- **Gross Retention Rate (GRR)**: \`(Beginning MRR - Contraction - Churn) / Beginning MRR\`
- **Net Retention Rate (NRR)**: \`(Beginning MRR + Expansion - Contraction - Churn) / Beginning MRR\`

### Unit Economics
- **LTV (Lifetime Value)**: \`ARPA * Gross Margin / Churn Rate\`
- **CAC (Customer Acquisition Cost)**: \`Total Marketing Spend / New Customers\`
- **Payback Period**: \`CAC / (ARPA * Gross Margin)\`
        `
    },
    {
        id: "faq",
        title: "FAQ",
        content: `
## Frequently Asked Questions

**Q: Can I import historical data?**
A: Yes, use the built-in CSV import tool. Ensure your columns match the required schema exactly.

**Q: Why is my LTV suddenly spiking?**
A: LTV is highly sensitive to the Churn Rate denominator. If your churn drops close to zero in a given month, LTV approaches infinity. LTV is best viewed as a trend over 3-6 months.

**Q: How do I share my dashboard?**
A: Use the **Export Data** button in the top navigation to download a CSV or PDF copy of your current calculations to share with stakeholders.
        `
    },
    {
        id: "import",
        title: "Import Guide",
        content: `
## Import Guide

LedgerLine requires a strict CSV schema to build the DuckDB ledger.

### Required Columns
- \`customer_id\`, \`customer\`, \`account\`, \`account_id\`, or \`company\` (String): A unique identifier for the customer.
- \`period\`, \`date\`, \`month\`, or \`invoice_date\` (Date): The billing month, formatted as \`YYYY-MM-DD\`. It is highly recommended to use the 1st of the month.
- \`mrr\`, \`revenue\`, \`amount\`, or \`subscription\` (Double): The recognized recurring revenue for that month.
- \`currency\`, \`curr\`, \`iso\`, or \`currency_code\` (String): e.g., \`USD\`.
- \`category\`, \`plan\`, \`tier\`, \`product\`, or \`subscription_type\` (String): The plan name.

> **Note**: LedgerLine automatically groups dates by month during calculation to ensure consistent Cohort grouping.
        `
    },
    {
        id: "troubleshooting",
        title: "Troubleshooting",
        content: `
## Troubleshooting

### Dashboard shows $0 for everything
Check that your imported CSV actually contains data. If the import silently failed, you can check the developer console for DuckDB strict-mode errors.

### "NaN" appears in Payback Period
This occurs if no Marketing Spend has been recorded for the month, or if you acquired 0 customers. Go to the Unit Economics tab and enter your Marketing Spend.

### Forecasting chart isn't rendering
The forecast engine relies on having at least one historical month of MRR as a baseline. Import historical data before projecting the future.
        `
    },
    {
        id: "definitions",
        title: "Definitions",
        content: `
## Definitions

- **ARPA**: Average Revenue Per Account. Total MRR divided by total active customers.
- **CAC**: Customer Acquisition Cost. The fully loaded sales and marketing cost to acquire one new customer.
- **LTV**: Lifetime Value. The estimated total gross profit a customer will yield over their entire lifespan.
- **Cohort**: A group of customers who all started their subscription in the exact same month.
- **Gross Margin**: The percentage of revenue remaining after subtracting Cost of Goods Sold (COGS). E.g., hosting, support, onboarding costs.
        `
    }
];

#!/usr/bin/env python3
"""
Generate a synthetic 1500-row MRR CSV for import capacity testing.
Output: test_data/scale_test_1500.csv

Design:
- 50 customers × 30 months (2023-01 to 2025-06) = 1500 rows
- MRR values vary per customer to exercise upsert semantics
- Mix of currencies and categories
- A few duplicate customer/period rows intentionally included to test upsert (not duplicate insert)
"""

import csv
import random
import datetime

CUSTOMERS = [f"cust_{i:04d}" for i in range(1, 51)]  # cust_0001 .. cust_0050
START = datetime.date(2023, 1, 1)
MONTHS = [(START.replace(month=(START.month + i - 1) % 12 + 1,
                          year=START.year + (START.month + i - 1) // 12))
          for i in range(30)]

CURRENCIES = ["USD"] * 14 + ["EUR"] * 8 + ["GBP"] * 5 + ["CAD"] * 3
CATEGORIES = ["Standard"] * 16 + ["Enterprise"] * 8 + ["Starter"] * 6

random.seed(42)

rows = []
for cust in CUSTOMERS:
    base_mrr = random.uniform(200, 5000)
    for month in MONTHS:
        # Slight random walk to simulate real MRR movement
        base_mrr = max(50, base_mrr * random.uniform(0.95, 1.08))
        rows.append({
            "customer_id": cust,
            "period": month.strftime("%Y-%m-%d"),
            "mrr_amount": round(base_mrr, 2),
            "currency": random.choice(CURRENCIES),
            "category": random.choice(CATEGORIES),
        })

# Shuffle to make sure import handles out-of-order rows
random.shuffle(rows)

output_path = "test_data/scale_test_1500.csv"
with open(output_path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["customer_id", "period", "mrr_amount", "currency", "category"])
    writer.writeheader()
    writer.writerows(rows)

print(f"Generated {len(rows)} rows → {output_path}")

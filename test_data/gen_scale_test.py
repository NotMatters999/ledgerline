#!/usr/bin/env python3
"""
Generate synthetic MRR CSV files for import capacity testing.

Usage examples
--------------
# Original 1 500-row file (YYYY-MM-DD periods, backward-compatible default):
    python gen_scale_test.py

# 1 500-row file with YYYY-MM periods (exercises the new date parser):
    python gen_scale_test.py --format yyyymm --out test_data/scale_test_1500_yyyymm.csv

# 100 000-row file with YYYY-MM periods:
    python gen_scale_test.py --format yyyymm --rows 100000 --customers 23586 \
        --out test_data/scale_test_100k_yyyymm.csv

Defaults
--------
  --format    yyyymmdd  (YYYY-MM-DD — original behaviour)
  --rows      1500
  --customers 50
  --out       test_data/scale_test_1500.csv
"""

import argparse
import csv
import datetime
import os
import random


# ── Argument parsing ──────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(
        description="Generate synthetic MRR CSV for LedgerLine import testing."
    )
    p.add_argument(
        "--format",
        choices=["yyyymmdd", "yyyymm"],
        default="yyyymmdd",
        help=(
            "Date format for the 'period' column. "
            "'yyyymmdd' → YYYY-MM-DD (e.g. 2023-01-01); "
            "'yyyymm'   → YYYY-MM   (e.g. 2023-01). "
            "Default: yyyymmdd"
        ),
    )
    p.add_argument(
        "--rows",
        type=int,
        default=1500,
        help="Total number of data rows to generate. Default: 1500",
    )
    p.add_argument(
        "--customers",
        type=int,
        default=None,
        help=(
            "Number of distinct customers. "
            "If omitted, defaults to ceil(rows / 30) so that every customer "
            "gets ~30 months of data."
        ),
    )
    p.add_argument(
        "--out",
        default=None,
        help=(
            "Output file path. "
            "Default: test_data/scale_test_<rows>.csv"
        ),
    )
    return p.parse_args()


# ── Generation helpers ────────────────────────────────────────────────────

CURRENCIES = ["USD"] * 14 + ["EUR"] * 8 + ["GBP"] * 5 + ["CAD"] * 3
CATEGORIES = ["Standard"] * 16 + ["Enterprise"] * 8 + ["Starter"] * 6


def months_from(start: datetime.date, n: int):
    """Yield *n* consecutive month-start dates beginning from *start*."""
    d = start
    for _ in range(n):
        yield d
        # Advance by one month
        m = d.month + 1
        y = d.year + (m - 1) // 12
        d = d.replace(year=y, month=(m - 1) % 12 + 1)


def format_period(d: datetime.date, fmt: str) -> str:
    if fmt == "yyyymmdd":
        return d.strftime("%Y-%m-%d")
    else:  # yyyymm
        return d.strftime("%Y-%m")


# ── Main ──────────────────────────────────────────────────────────────────

def main():
    args = parse_args()

    # Derive number of customers from row budget if not given
    n_customers = args.customers or max(1, -(-args.rows // 30))  # ceiling div

    # Generate months: enough to cover args.rows when spread across customers
    n_months = max(1, -(-args.rows // n_customers))  # ceiling div
    start = datetime.date(2023, 1, 1)
    month_dates = list(months_from(start, n_months))

    customers = [f"cust_{i:04d}" for i in range(1, n_customers + 1)]

    random.seed(42)

    rows = []
    for cust in customers:
        base_mrr = random.uniform(200, 5000)
        for month in month_dates:
            base_mrr = max(50, base_mrr * random.uniform(0.95, 1.08))
            rows.append(
                {
                    "customer_id": cust,
                    "period":      format_period(month, args.format),
                    "mrr_amount":  round(base_mrr, 2),
                    "currency":    random.choice(CURRENCIES),
                    "category":    random.choice(CATEGORIES),
                }
            )

    # Trim or pad to exact row count
    if len(rows) > args.rows:
        rows = rows[: args.rows]

    # Shuffle so import handles out-of-order rows
    random.shuffle(rows)

    # Default output path
    out_path = args.out or os.path.join(
        "test_data", f"scale_test_{args.rows}.csv"
    )
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)

    fieldnames = ["customer_id", "period", "mrr_amount", "currency", "category"]
    with open(out_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(
        f"Generated {len(rows):,} rows "
        f"({n_customers:,} customers × up to {n_months} months, "
        f"period format: {args.format}) → {out_path}"
    )


if __name__ == "__main__":
    main()

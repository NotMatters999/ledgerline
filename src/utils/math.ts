export function percentToDecimal(percent: number): number {
  return Math.round(percent * 100) / 10000;
}

export function decimalToPercent(decimal: number): string {
  return (Math.round(decimal * 10000) / 100).toString();
}

export function validateMrrAmount(amountStr: string): number {
  if (!amountStr || amountStr.trim() === '') {
    throw new Error("MRR amount cannot be empty.");
  }
  const parsed = Number(amountStr.trim());
  if (isNaN(parsed) || parsed < 0) {
    throw new Error("MRR amount must be a valid positive number.");
  }
  return parsed;
}

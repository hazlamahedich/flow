export function parseDollarToCents(value: string): number | null {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = parseFloat(value);
  if (isNaN(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

export function formatCentsToDollar(cents: number | null): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

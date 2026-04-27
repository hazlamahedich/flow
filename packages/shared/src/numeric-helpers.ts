export function numericToMinutes(hoursStr: string | null): number {
  if (!hoursStr) return 0;
  const hours = parseFloat(hoursStr);
  if (Number.isNaN(hours)) return 0;
  return Math.round(hours * 60);
}

export function minutesToNumericStr(minutes: number): string {
  const totalHours = minutes / 60;
  return totalHours.toFixed(2);
}

export function calculateThresholdMinutes(allocatedHoursStr: string | null): number | null {
  if (!allocatedHoursStr) return null;
  const allocatedMinutes = numericToMinutes(allocatedHoursStr);
  if (allocatedMinutes <= 0) return null;
  return Math.floor(allocatedMinutes * 90 / 100);
}

export function isScopeCreep(trackedMinutes: number, thresholdMinutes: number | null): boolean {
  if (thresholdMinutes === null || thresholdMinutes <= 0) return false;
  return trackedMinutes >= thresholdMinutes;
}

export function formatCentsToDollar(cents: number | null): string {
  if (cents === null || cents === undefined) return '';
  return (cents / 100).toFixed(2);
}

export function parseDollarToCents(value: string): number | null {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}

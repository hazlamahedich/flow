export function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

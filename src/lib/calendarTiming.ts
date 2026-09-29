export function isCalendarCardPast(end: string | null | undefined, now: Date): boolean {
  if (!end) return false;
  const timestamp = new Date(end).getTime();
  return Number.isFinite(timestamp) && timestamp <= now.getTime();
}

export function calendarCardEnd(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start) return null;
  const startMs = new Date(start).getTime();
  if (!Number.isFinite(startMs)) return null;
  const endMs = end ? new Date(end).getTime() : NaN;
  return new Date(Number.isFinite(endMs) && endMs > startMs ? endMs : startMs + 3600000).toISOString();
}

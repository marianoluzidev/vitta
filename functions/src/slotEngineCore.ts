/**
 * Copia alineada con src/services/slotEngine.ts — mantener ambas en sync al cambiar reglas de agenda.
 * @see src/services/slotEngine.ts
 */

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export interface Interval {
  start: number;
  end: number;
}

export interface ScheduleBlock {
  start: string;
  end: string;
  breaks: Array<{ start: string; end: string }>;
}

export type Schedule = Record<DayKey, ScheduleBlock[]>;

export interface StaffException {
  date: string;
  type: 'full_day' | 'range';
  start?: string | null;
  end?: string | null;
}

export interface BookingOnDay {
  startTime: string;
  endTime: string;
  status?: string;
}

export interface SlotResult {
  start: string;
  end: string;
  startMinutes: number;
  endMinutes: number;
}

export function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getWeekdayFromDate(dateStr: string): DayKey {
  const d = new Date(dateStr + 'T12:00:00');
  return DAY_KEYS[d.getDay()];
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length <= 1) return intervals;
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      out.push({ ...sorted[i] });
    }
  }
  return out;
}

export function subtractIntervals(open: Interval[], busy: Interval[]): Interval[] {
  let result: Interval[] = open.map((i) => ({ ...i }));
  for (const b of busy) {
    const next: Interval[] = [];
    for (const a of result) {
      if (b.end <= a.start || b.start >= a.end) {
        next.push(a);
      } else {
        if (a.start < b.start) next.push({ start: a.start, end: b.start });
        if (b.end < a.end) next.push({ start: b.end, end: a.end });
      }
    }
    result = next;
  }
  return mergeIntervals(result);
}

export function intervalsOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function openIntervalsFromBlocks(blocks: ScheduleBlock[]): Interval[] {
  const open: Interval[] = [];
  for (const block of blocks) {
    const start = parseTime(block.start);
    const end = parseTime(block.end);
    const breakInts: Interval[] = (block.breaks || []).map((br) => ({
      start: parseTime(br.start),
      end: parseTime(br.end),
    }));
    const blockInterval = [{ start, end }];
    const free = subtractIntervals(blockInterval, breakInts);
    open.push(...free);
  }
  return mergeIntervals(open);
}

export function blockedFromBreaks(blocks: ScheduleBlock[]): Interval[] {
  const out: Interval[] = [];
  for (const block of blocks) {
    for (const br of block.breaks || []) {
      out.push({ start: parseTime(br.start), end: parseTime(br.end) });
    }
  }
  return mergeIntervals(out);
}

export function isStartWithinOpenIntervals(startMinutes: number, openIntervals: Interval[]): boolean {
  return openIntervals.some((iv) => startMinutes >= iv.start && startMinutes <= iv.end);
}

export function bookingIntersectsBlocked(
  startMinutes: number,
  endMinutes: number,
  mergedBlocked: Interval[]
): boolean {
  return mergedBlocked.some((b) => intervalsOverlap(startMinutes, endMinutes, b.start, b.end));
}

export function computeAvailableSlots(
  schedule: Schedule,
  exceptions: StaffException[],
  bookings: BookingOnDay[],
  date: string,
  durationMinutes: number,
  stepMinutes: number,
  dayEnabled?: Record<DayKey, boolean> | null
): SlotResult[] {
  const day = getWeekdayFromDate(date);
  const blocks = schedule[day] ?? [];

  if (dayEnabled && dayEnabled[day] === false) return [];
  if (!blocks.length) return [];

  const open = openIntervalsFromBlocks(blocks);
  const blockedByBreaks = blockedFromBreaks(blocks);

  const blockedByExceptions: Interval[] = [];
  for (const ex of exceptions) {
    if (ex.type === 'full_day') {
      blockedByExceptions.push({ start: 0, end: 24 * 60 });
      break;
    }
    if (ex.type === 'range' && ex.start != null && ex.end != null) {
      blockedByExceptions.push({
        start: parseTime(ex.start),
        end: parseTime(ex.end),
      });
    }
  }

  const blockedByBookings: Interval[] = bookings
    .filter((b) => (b.status ?? '') !== 'cancelled')
    .map((b) => ({
      start: parseTime(b.startTime),
      end: parseTime(b.endTime),
    }));

  const allBlocked = mergeIntervals([...blockedByBreaks, ...blockedByExceptions, ...blockedByBookings]);

  const slots: SlotResult[] = [];
  for (const openIv of open) {
    let t = openIv.start;
    while (t <= openIv.end) {
      const endMin = t + durationMinutes;
      if (!bookingIntersectsBlocked(t, endMin, allBlocked)) {
        slots.push({
          start: minutesToTime(t),
          end: minutesToTime(endMin),
          startMinutes: t,
          endMinutes: endMin,
        });
      }
      t += stepMinutes;
    }
  }
  return slots;
}

export type BookingValidationFailure =
  | 'INVALID_DURATION'
  | 'DAY_DISABLED'
  | 'NO_SCHEDULE'
  | 'OUTSIDE_AVAILABILITY'
  | 'BLOCKED';

export function validateNewBookingTimes(params: {
  schedule: Schedule;
  dayEnabled?: Record<DayKey, boolean> | null;
  date: string;
  startTime: string;
  endTime: string;
  totalDurationMinutes: number;
  exceptions: StaffException[];
  existingBookings: BookingOnDay[];
}): { ok: true } | { ok: false; reason: BookingValidationFailure } {
  const { schedule, dayEnabled, date, startTime, endTime, totalDurationMinutes, exceptions, existingBookings } =
    params;
  const day = getWeekdayFromDate(date);
  const blocks = schedule[day] ?? [];

  if (dayEnabled && dayEnabled[day] === false) {
    return { ok: false, reason: 'DAY_DISABLED' };
  }
  if (!blocks.length) {
    return { ok: false, reason: 'NO_SCHEDULE' };
  }

  const startMin = parseTime(startTime);
  const endMin = parseTime(endTime);
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
    return { ok: false, reason: 'INVALID_DURATION' };
  }
  if (endMin - startMin !== totalDurationMinutes) {
    return { ok: false, reason: 'INVALID_DURATION' };
  }

  const open = openIntervalsFromBlocks(blocks);
  if (!isStartWithinOpenIntervals(startMin, open)) {
    return { ok: false, reason: 'OUTSIDE_AVAILABILITY' };
  }

  const blockedByBreaks = blockedFromBreaks(blocks);
  const blockedByExceptions: Interval[] = [];
  for (const ex of exceptions) {
    if (ex.type === 'full_day') {
      return { ok: false, reason: 'BLOCKED' };
    }
    if (ex.type === 'range' && ex.start != null && ex.end != null) {
      blockedByExceptions.push({
        start: parseTime(ex.start),
        end: parseTime(ex.end),
      });
    }
  }
  const blockedByBookings: Interval[] = existingBookings
    .filter((b) => (b.status ?? '') !== 'cancelled')
    .map((b) => ({
      start: parseTime(b.startTime),
      end: parseTime(b.endTime),
    }));
  const allBlocked = mergeIntervals([...blockedByBreaks, ...blockedByExceptions, ...blockedByBookings]);

  if (bookingIntersectsBlocked(startMin, endMin, allBlocked)) {
    return { ok: false, reason: 'BLOCKED' };
  }

  return { ok: true };
}

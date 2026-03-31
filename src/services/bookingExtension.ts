/**
 * Lógica para extender un turno: calcular máximo horario de fin sin conflictos
 * y persistir la extensión con historial.
 *
 * El tope de extensión no está limitado por el fin del bloque de disponibilidad:
 * solo por breaks, excepciones y otros turnos (misma filosofía que el motor de slots).
 */
import {
  mergeIntervals,
  blockedFromBreaks,
  parseTime,
  minutesToTime,
  getWeekdayFromDate,
  intervalsOverlap,
  type Schedule,
  type StaffException,
  type BookingOnDay,
  type DayKey,
} from './slotEngine';
import { getDbInstance } from '../firebase/firebase';
import { getCurrentUser } from '../auth/session';
import {
  doc,
  getDoc,
  getDocs,
  query,
  collection,
  where,
  runTransaction,
  serverTimestamp,
  arrayUnion,
  Timestamp,
  type UpdateData,
} from 'firebase/firestore';

const STEP_MINUTES = 15;

export interface MaxEndResult {
  maxEndTime: string;
  canExtend: boolean;
  /** Para el timeline: límite derecho (siguiente bloque o fin de día) */
  rightBoundTime: string;
}

export interface ExtendBookingParams {
  tenantId: string;
  bookingId: string;
  staffId: string;
  date: string;
  startTime: string;
  currentEndTime: string;
  newEndTime: string;
}

export interface ExtendedHistoryEntry {
  type: 'extended';
  beforeEnd: string;
  afterEnd: string;
  minutesAdded: number;
  by: { type: 'admin' | 'staff'; id?: string | null };
  at: unknown;
}

interface Interval {
  start: number;
  end: number;
}

/**
 * Calcula el máximo horario de fin hasta donde se puede extender el turno
 * sin solaparse con otro turno, break o excepción (sin tope artificial por fin de jornada).
 */
export async function getMaxEndTime(
  tenantId: string,
  staffId: string,
  date: string,
  bookingId: string,
  currentStartTime: string,
  currentEndTime: string
): Promise<MaxEndResult> {
  const db = getDbInstance();
  const startMin = parseTime(currentStartTime);
  const endMin = parseTime(currentEndTime);

  if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) {
    return {
      maxEndTime: currentEndTime,
      canExtend: false,
      rightBoundTime: currentEndTime,
    };
  }

  const currentBookingId = String(bookingId);

  const [staffSnap, bookingsSnap, exceptionsSnap] = await Promise.all([
    getDoc(doc(db, 'tenants', tenantId, 'staff', staffId)),
    getDocs(
      query(
        collection(db, 'tenants', tenantId, 'bookings'),
        where('staffId', '==', staffId),
        where('date', '==', date)
      )
    ),
    getDocs(
      query(
        collection(db, 'tenants', tenantId, 'staff', staffId, 'exceptions'),
        where('date', '==', date)
      )
    ),
  ]);

  const schedule: Schedule = (staffSnap.exists() && (staffSnap.data()?.schedule as Schedule)) || ({} as Schedule);
  const dayEnabled = staffSnap.exists() ? (staffSnap.data()?.dayEnabled as Record<DayKey, boolean> | undefined) : undefined;

  const bookings: BookingOnDay[] = bookingsSnap.docs
    .filter((d) => d.id !== currentBookingId)
    .map((d) => {
      const data = d.data();
      return {
        startTime: data.startTime ?? '',
        endTime: data.endTime ?? '',
        status: data.status ?? '',
      };
    });

  const exceptions: StaffException[] = exceptionsSnap.docs.map((d) => {
    const data = d.data();
    return {
      date: data.date ?? '',
      type: (data.type ?? 'full_day') as 'full_day' | 'range',
      start: data.start ?? null,
      end: data.end ?? null,
    };
  });

  const day = getWeekdayFromDate(date);
  const blocks = schedule[day] ?? [];
  const useFallback = blocks.length === 0 || (dayEnabled && dayEnabled[day] === false);

  let maxEndMin = endMin;

  if (useFallback) {
    const endOfDayDefault = 20 * 60;
    const limits: number[] = [endOfDayDefault];

    for (const b of bookings) {
      if ((b.status ?? '') === 'cancelled') continue;
      const m = parseTime(b.startTime);
      if (Number.isFinite(m) && m >= endMin) limits.push(m);
    }

    for (const ex of exceptions) {
      if (ex.type === 'range' && ex.start != null) {
        const exStart = parseTime(ex.start);
        if (Number.isFinite(exStart) && exStart >= endMin) limits.push(exStart);
      }
    }

    const validLimits = limits.filter(Number.isFinite);
    const minLimit = validLimits.length > 0 ? Math.min(...validLimits) : endOfDayDefault;
    if (minLimit > endMin) maxEndMin = minLimit;
  } else {
    const blockedByBreaks = blockedFromBreaks(blocks);
    const blockedByExceptions: Interval[] = [];
    for (const ex of exceptions) {
      if (ex.type === 'full_day') {
        return {
          maxEndTime: currentEndTime,
          canExtend: false,
          rightBoundTime: currentEndTime,
        };
      }
      if (ex.type === 'range' && ex.start != null && ex.end != null) {
        blockedByExceptions.push({ start: parseTime(ex.start), end: parseTime(ex.end) });
      }
    }
    const blockedByBookings: Interval[] = bookings
      .filter((b) => (b.status ?? '') !== 'cancelled')
      .map((b) => ({
        start: parseTime(b.startTime),
        end: parseTime(b.endTime),
      }));
    const allBlocked = mergeIntervals([...blockedByBreaks, ...blockedByExceptions, ...blockedByBookings]);

    let t = endMin + STEP_MINUTES;
    const dayCap = 24 * 60;
    while (t <= dayCap) {
      if (allBlocked.some((block) => intervalsOverlap(startMin, t, block.start, block.end))) {
        break;
      }
      maxEndMin = t;
      t += STEP_MINUTES;
    }
  }

  const maxEndTime = minutesToTime(maxEndMin);
  const canExtend = maxEndMin > endMin;

  return {
    maxEndTime,
    canExtend,
    rightBoundTime: maxEndTime,
  };
}

/**
 * Redondea un horario (en minutos) al paso de 15 minutos hacia abajo.
 */
export function roundDownToStep(minutes: number, step: number = STEP_MINUTES): number {
  return Math.floor(minutes / step) * step;
}

/**
 * Genera las opciones de horario de fin en pasos de 15 min entre currentEnd y maxEnd (incluye currentEnd).
 */
export function getEndTimeOptions(currentEndTime: string, maxEndTime: string): string[] {
  const currentMin = parseTime(currentEndTime);
  const maxMin = parseTime(maxEndTime);
  if (maxMin < currentMin) return [currentEndTime];
  const options: string[] = [];
  let m = roundDownToStep(currentMin);
  if (m < currentMin) m = currentMin;
  while (m <= maxMin) {
    options.push(minutesToTime(m));
    m += STEP_MINUTES;
  }
  if (options.length === 0) options.push(currentEndTime);
  return options;
}

/**
 * Extiende el turno: actualiza endTime, endAt, totalDurationMinutes, slotState e historial.
 */
export async function extendBooking(params: ExtendBookingParams): Promise<void> {
  const { tenantId, bookingId, staffId, date, startTime, currentEndTime, newEndTime } = params;
  const db = getDbInstance();
  const user = getCurrentUser();
  const lockId = `${staffId}_${date}`;
  const slotStateRef = doc(db, 'tenants', tenantId, 'slotState', lockId);
  const bookingRef = doc(db, 'tenants', tenantId, 'bookings', bookingId);

  const newEndAt = new Date(`${date}T${newEndTime}:00`);
  const startMin = parseTime(startTime);
  const prevEndMin = parseTime(currentEndTime);
  const newEndMin = parseTime(newEndTime);
  const minutesAdded = newEndMin - prevEndMin;
  const newDurationMinutes = newEndMin - startMin;

  const historyEntry: ExtendedHistoryEntry = {
    type: 'extended',
    beforeEnd: currentEndTime,
    afterEnd: newEndTime,
    minutesAdded,
    by: { type: 'admin', id: user?.uid ?? null },
    at: Timestamp.now(),
  };

  await runTransaction(db, async (tx) => {
    const slotStateSnap = await tx.get(slotStateRef);
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists()) throw new Error('BOOKING_NOT_FOUND');

    const slots: Array<{ startTime: string; endTime: string }> = slotStateSnap.exists()
      ? (slotStateSnap.data()?.slots ?? [])
      : [];
    const withoutOld = slots.filter((s) => !(s.startTime === startTime && s.endTime === currentEndTime));
    const newSlots = [...withoutOld, { startTime, endTime: newEndTime }];

    const patch: UpdateData<Record<string, unknown>> = {
      endTime: newEndTime,
      endAt: Timestamp.fromDate(newEndAt),
      totalDurationMinutes: newDurationMinutes,
      updatedAt: serverTimestamp(),
      statusHistory: arrayUnion(historyEntry),
    };
    if (user?.uid) (patch as Record<string, unknown>).updatedByUid = user.uid;

    if (slotStateSnap.exists()) {
      tx.update(slotStateRef, { slots: newSlots, updatedAt: serverTimestamp() });
    } else {
      tx.set(slotStateRef, { staffId, date, slots: newSlots, updatedAt: serverTimestamp() });
    }
    tx.update(bookingRef, patch);
  });
}

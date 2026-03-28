/**
 * Lógica para extender un turno: calcular máximo horario de fin sin conflictos
 * y persistir la extensión con historial.
 */
import {
  getFreeIntervalsOnDay,
  parseTime,
  minutesToTime,
  getWeekdayFromDate,
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

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
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

/**
 * Calcula el máximo horario de fin hasta donde se puede extender el turno
 * sin solaparse con otro turno, break o excepción.
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

  console.log('[Extend] getMaxEndTime', {
    tenantId,
    staffId,
    date,
    bookingId,
    currentStartTime,
    currentEndTime,
    startMin,
    endMin,
    startMinValid: Number.isFinite(startMin),
    endMinValid: Number.isFinite(endMin),
  });

  if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) {
    console.log('[Extend] Salida temprana: startMin o endMin inválidos');
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

  const allBookingIds = bookingsSnap.docs.map((d) => d.id);
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

  console.log('[Extend] Datos cargados', {
    staffExists: staffSnap.exists(),
    scheduleKeys: staffSnap.exists() ? Object.keys(staffSnap.data()?.schedule ?? {}) : [],
    allBookingIds,
    currentBookingId,
    otherBookingsCount: bookings.length,
    otherBookings: bookings.map((b) => ({ start: b.startTime, end: b.endTime, status: b.status })),
    exceptionsCount: exceptionsSnap.docs.length,
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
  let useFallback = blocks.length === 0 || (dayEnabled && dayEnabled[day] === false);

  console.log('[Extend] Día y bloques', { day, blocksCount: blocks.length, dayEnabled: dayEnabled?.[day], useFallback });

  let maxEndMin = endMin;

  if (!useFallback) {
    const freeIntervals = getFreeIntervalsOnDay(schedule, exceptions, bookings, date, dayEnabled ?? null);
    const containing = freeIntervals.find((iv) => iv.start <= startMin && iv.end >= endMin);
    console.log('[Extend] Intervalos libres', {
      freeIntervalsCount: freeIntervals.length,
      freeIntervals: freeIntervals.map((iv) => ({ start: iv.start, end: iv.end })),
      containing: containing ? { start: containing.start, end: containing.end } : null,
      containingHasRoom: containing ? containing.end > endMin : false,
    });
    if (containing && containing.end > endMin) {
      maxEndMin = containing.end;
    } else {
      useFallback = true;
    }
  }

  if (useFallback) {
    // Sin disponibilidad cargada o sin hueco: extender hasta el próximo turno o 20:00
    const endOfDayDefault = 20 * 60; // 20:00
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

    console.log('[Extend] Fallback', {
      limits,
      validLimits,
      minLimit,
      endMin,
      maxEndMinAfterFallback: maxEndMin,
      canExtendAfterFallback: maxEndMin > endMin,
    });
  }

  const maxEndTime = minutesToTime(maxEndMin);
  const canExtend = maxEndMin > endMin;

  console.log('[Extend] Resultado final', { maxEndTime, maxEndMin, endMin, canExtend });

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

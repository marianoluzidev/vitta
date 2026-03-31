/**
 * Slots para reprogramar: mismo motor que alta de turno (computeAvailableSlots).
 * En admin (usuario autenticado) lee Firestore y no depende de la versión desplegada de Cloud Functions.
 * En flujo público sin permisos de lectura, hace fallback a getAvailableSlots (callable).
 */
import { doc, getDoc, getDocs, query, collection, where } from 'firebase/firestore';
import { getDbInstance } from '../firebase/firebase';
import { computeAvailableSlots, type Schedule } from './slotEngine';
import { getAvailableSlots } from './publicBookingApi';

const SLOT_STEP = 15;

export async function loadRescheduleSlots(params: {
  tenantId: string;
  staffId: string;
  date: string;
  durationMinutes: number;
  excludeBookingId: string;
}): Promise<Array<{ start: string; end: string }>> {
  const { tenantId, staffId, date, durationMinutes, excludeBookingId } = params;

  try {
    const db = getDbInstance();
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

    if (!staffSnap.exists()) {
      return getAvailableSlots(tenantId, staffId, date, durationMinutes, excludeBookingId);
    }

    const staffData = staffSnap.data();
    const schedule = (staffData.schedule ?? {}) as Schedule;
    const dayEnabled = staffData.dayEnabled as Record<string, boolean> | undefined;

    const bookings = bookingsSnap.docs
      .filter((d) => d.id !== excludeBookingId)
      .map((d) => {
        const data = d.data();
        return {
          startTime: data.startTime ?? '',
          endTime: data.endTime ?? '',
          status: data.status ?? '',
        };
      });

    const exceptions = exceptionsSnap.docs.map((d) => {
      const data = d.data();
      return {
        date: data.date ?? '',
        type: (data.type === 'range' ? 'range' : 'full_day') as 'full_day' | 'range',
        start: data.start ?? null,
        end: data.end ?? null,
      };
    });

    const slots = computeAvailableSlots(
      schedule,
      exceptions,
      bookings,
      date,
      durationMinutes,
      SLOT_STEP,
      dayEnabled ?? null
    );
    return slots.map((s) => ({ start: s.start, end: s.end }));
  } catch {
    return getAvailableSlots(tenantId, staffId, date, durationMinutes, excludeBookingId);
  }
}

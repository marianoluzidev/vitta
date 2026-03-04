import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayKey = (typeof DAY_KEYS)[number];

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function getWeekdayFromDate(dateStr: string): DayKey {
  const d = new Date(dateStr + 'T12:00:00');
  return DAY_KEYS[d.getDay()];
}

interface Interval {
  start: number;
  end: number;
}
function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length <= 1) return intervals;
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i].start <= last.end) last.end = Math.max(last.end, sorted[i].end);
    else out.push({ ...sorted[i] });
  }
  return out;
}
function subtractIntervals(open: Interval[], busy: Interval[]): Interval[] {
  let result = open.map((i) => ({ ...i }));
  for (const b of busy) {
    const next: Interval[] = [];
    for (const a of result) {
      if (b.end <= a.start || b.start >= a.end) next.push(a);
      else {
        if (a.start < b.start) next.push({ start: a.start, end: b.start });
        if (b.end < a.end) next.push({ start: b.end, end: a.end });
      }
    }
    result = mergeIntervals(next);
  }
  return result;
}

interface ScheduleBlock {
  start: string;
  end: string;
  breaks: Array<{ start: string; end: string }>;
}

function openFromBlocks(blocks: ScheduleBlock[]): Interval[] {
  const open: Interval[] = [];
  for (const block of blocks) {
    const start = parseTime(block.start);
    const end = parseTime(block.end);
    const breakInts: Interval[] = (block.breaks || []).map((br) => ({
      start: parseTime(br.start),
      end: parseTime(br.end),
    }));
    const free = subtractIntervals([{ start, end }], breakInts);
    open.push(...free);
  }
  return mergeIntervals(open);
}

function blockedFromBreaks(blocks: ScheduleBlock[]): Interval[] {
  const out: Interval[] = [];
  for (const block of blocks || []) {
    for (const br of block.breaks || []) {
      out.push({ start: parseTime(br.start), end: parseTime(br.end) });
    }
  }
  return mergeIntervals(out);
}

const STEP = 15;

/**
 * Devuelve slots disponibles para un staff en una fecha (para reserva pública).
 */
export const getAvailableSlots = functions.https.onCall(
  async (request) => {
    const data = request.data as { tenantId: string; staffId: string; date: string; durationMinutes: number };
    const { tenantId, staffId, date, durationMinutes } = data;
    if (!tenantId || !staffId || !date || durationMinutes <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing or invalid parameters');
    }
    const tenantsRef = db.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantsRef.get();
    if (!tenantSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Tenant not found');
    }
    const staffRef = tenantsRef.collection('staff').doc(staffId);
    const staffSnap = await staffRef.get();
    if (!staffSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Staff not found');
    }
    const staffData = staffSnap.data()!;
    const schedule = (staffData.schedule ?? {}) as Record<string, ScheduleBlock[]>;
    const dayEnabled = (staffData.dayEnabled ?? {}) as Record<string, boolean>;
    const day = getWeekdayFromDate(date);
    const blocks = schedule[day] ?? [];
    if (dayEnabled[day] === false || blocks.length === 0) {
      return { slots: [] };
    }
    const open = openFromBlocks(blocks);
    const blockedByBreaks = blockedFromBreaks(blocks);
    const exceptionsSnap = await staffRef.collection('exceptions').where('date', '==', date).get();
    const blockedByExceptions: Interval[] = [];
    exceptionsSnap.docs.forEach((doc) => {
      const d = doc.data();
      if (d.type === 'full_day') blockedByExceptions.push({ start: 0, end: 24 * 60 });
      else if (d.type === 'range' && d.start && d.end)
        blockedByExceptions.push({ start: parseTime(d.start), end: parseTime(d.end) });
    });
    const bookingsSnap = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('bookings')
      .where('staffId', '==', staffId)
      .where('date', '==', date)
      .get();
    const blockedByBookings: Interval[] = bookingsSnap.docs
      .filter((d) => (d.data().status ?? '') !== 'cancelled')
      .map((d) => {
        const x = d.data();
        return { start: parseTime(x.startTime ?? '00:00'), end: parseTime(x.endTime ?? '00:00') };
      });
    const allBlocked = mergeIntervals([...blockedByBreaks, ...blockedByExceptions, ...blockedByBookings]);
    const free = subtractIntervals(open, allBlocked);
    const slots: Array<{ start: string; end: string }> = [];
    for (const iv of free) {
      let t = iv.start;
      while (t + durationMinutes <= iv.end) {
        const endMin = t + durationMinutes;
        const overlaps = allBlocked.some((b) => t < b.end && endMin > b.start);
        if (!overlaps) slots.push({ start: minutesToTime(t), end: minutesToTime(endMin) });
        t += STEP;
      }
    }
    return { slots };
  }
);

/**
 * Busca cliente por DNI (solo devuelve datos para autocompletar formulario).
 */
export const findClientByDni = functions.https.onCall(
  async (request) => {
    const data = request.data as { tenantId: string; dni: string };
    const { tenantId, dni } = data;
    if (!tenantId || !dni || String(dni).trim().length === 0) {
      return null;
    }
    const clientsSnap = await db
      .collection('tenants')
      .doc(tenantId)
      .collection('clients')
      .where('dni', '==', String(dni).trim())
      .limit(1)
      .get();
    if (clientsSnap.empty) return null;
    const doc = clientsSnap.docs[0];
    const d = doc.data();
    return {
      clientId: doc.id,
      firstName: d.firstName ?? '',
      lastName: d.lastName ?? '',
      phone: d.phone ?? '',
      email: d.email ?? '',
    };
  }
);

/**
 * Crea reserva pública: cliente (create/update) + booking + slotState. Opcional: envía email.
 */
export const createPublicBooking = functions.https.onCall(
  async (request) => {
    const data = request.data as {
      tenantId: string;
      payload: {
        staffId: string;
        serviceIds: string[];
        date: string;
        startTime: string;
        endTime: string;
        client: { dni: string; firstName: string; lastName: string; phone: string; email: string };
      };
    };
    const { tenantId, payload } = data;
    if (!tenantId || !payload?.staffId || !payload?.date || !payload?.startTime || !payload?.endTime || !payload?.client?.dni) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    const tenantRef = db.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists || (tenantSnap.data() as any)?.isActive === false) {
      throw new functions.https.HttpsError('failed-precondition', 'Tenant not found or inactive');
    }
    const servicesSnap = await tenantRef.collection('services').get();
    const servicesMap = new Map(servicesSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
    const staffSnap = await tenantRef.collection('staff').doc(payload.staffId).get();
    if (!staffSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Staff not found');
    }
    const staffData = staffSnap.data()!;
    const staffName = [staffData.firstName, staffData.lastName].filter(Boolean).join(' ') || 'Staff';
    const servicesSnapshot = payload.serviceIds
      .map((id) => servicesMap.get(id))
      .filter(Boolean)
      .map((s: any) => ({
        id: s.id,
        name: s.name,
        price: s.price ?? 0,
        durationMinutes: s.durationMinutes ?? 0,
      }));
    const totalDuration = servicesSnapshot.reduce((acc: number, s: any) => acc + (s.durationMinutes ?? 0), 0);
    const totalPrice = servicesSnapshot.reduce((acc: number, s: any) => acc + (s.price ?? 0), 0);
    const dni = String(payload.client.dni).trim();
    const clientsRef = tenantRef.collection('clients');
    let clientId: string;
    const clientSnap = await clientsRef.where('dni', '==', dni).limit(1).get();
    if (!clientSnap.empty) {
      clientId = clientSnap.docs[0].id;
      await clientSnap.docs[0].ref.update({
        firstName: payload.client.firstName.trim(),
        lastName: payload.client.lastName.trim(),
        phone: payload.client.phone.trim(),
        email: payload.client.email.trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const newClient = await clientsRef.add({
        dni,
        firstName: payload.client.firstName.trim(),
        lastName: payload.client.lastName.trim(),
        phone: payload.client.phone.trim(),
        email: payload.client.email.trim(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      clientId = newClient.id;
    }
    const lockId = `${payload.staffId}_${payload.date}`;
    const lockRef = tenantRef.collection('locks').doc(lockId);
    const slotStateRef = tenantRef.collection('slotState').doc(lockId);
    const bookingsRef = tenantRef.collection('bookings');
    const newBookingRef = bookingsRef.doc();
    const startAt = new Date(`${payload.date}T${payload.startTime}:00`);
    const endAt = new Date(`${payload.date}T${payload.endTime}:00`);
    const publicManageToken = Array.from({ length: 48 }, () => Math.random().toString(36)[2]).join('');
    const now = admin.firestore.Timestamp.now();
    const statusHistory = [{ at: now, from: '', to: 'confirmed', by: { type: 'client' }, note: 'created' }];
    const bookingData = {
      tenantId,
      clientId,
      clientSnapshot: {
        dni: payload.client.dni,
        firstName: payload.client.firstName.trim(),
        lastName: payload.client.lastName.trim(),
        phone: payload.client.phone.trim(),
        email: payload.client.email.trim(),
      },
      staffId: payload.staffId,
      staffName,
      serviceIds: payload.serviceIds,
      servicesSnapshot,
      totalPrice,
      totalDurationMinutes: totalDuration,
      date: payload.date,
      startTime: payload.startTime,
      endTime: payload.endTime,
      startAt: admin.firestore.Timestamp.fromDate(startAt),
      endAt: admin.firestore.Timestamp.fromDate(endAt),
      status: 'confirmed',
      source: 'public',
      publicManageToken,
      statusHistory,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef);
      const slotStateSnap = await tx.get(slotStateRef);
      const slots: Array<{ startTime: string; endTime: string }> = slotStateSnap.exists
        ? (slotStateSnap.data()?.slots ?? [])
        : [];
      const overlaps = slots.some(
        (s) =>
          parseTime(s.startTime) < parseTime(payload.endTime) &&
          parseTime(s.endTime) > parseTime(payload.startTime)
      );
      if (overlaps) {
        throw new functions.https.HttpsError('failed-precondition', 'SLOT_TAKEN');
      }
      if (!lockSnap.exists) {
        tx.set(lockRef, { staffId: payload.staffId, date: payload.date, updatedAt: admin.firestore.FieldValue.serverTimestamp(), version: 1 });
      } else {
        tx.update(lockRef, { updatedAt: admin.firestore.FieldValue.serverTimestamp(), version: admin.firestore.FieldValue.increment(1) });
      }
      const newSlot = { startTime: payload.startTime, endTime: payload.endTime };
      if (!slotStateSnap.exists) {
        tx.set(slotStateRef, { staffId: payload.staffId, date: payload.date, slots: [newSlot], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        tx.update(slotStateRef, {
          slots: admin.firestore.FieldValue.arrayUnion(newSlot),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      tx.set(newBookingRef, bookingData);
    });
    const bookingId = newBookingRef.id;
    if (payload.client.email && payload.client.email.trim()) {
      try {
        await sendBookingConfirmationEmail(tenantId, bookingId, (tenantSnap.data() as any)?.name ?? 'Local', publicManageToken);
      } catch (e) {
        functions.logger.warn('Email send failed', e);
      }
    }
    return { success: true, bookingId, message: 'Reserva confirmada' };
  }
);

async function sendBookingConfirmationEmail(tenantId: string, bookingId: string, tenantName: string, manageToken?: string): Promise<void> {
  const bookingSnap = await db.collection('tenants').doc(tenantId).collection('bookings').doc(bookingId).get();
  if (!bookingSnap.exists) return;
  const b = bookingSnap.data()!;
  const email = (b.clientSnapshot as any)?.email;
  if (!email) return;
  const manageUrl = manageToken ? `https://YOUR_APP_URL/t/${tenantId}/manage/${bookingId}/?token=${manageToken}` : '';
  // Placeholder: en producción conectar SendGrid/Mailgun/nodemailer e incluir manageUrl en el cuerpo
  functions.logger.info('Would send confirmation email', { to: email, tenantName, date: b.date, startTime: b.startTime, manageUrl });
}

async function getTenantBookingSettings(tenantId: string): Promise<{ clientCancelWindowHours: number; staffCancelWindowHours: number; clientRescheduleWindowHours: number; staffRescheduleWindowHours: number; allowClientCancel: boolean; allowClientReschedule: boolean }> {
  const snap = await db.collection('tenants').doc(tenantId).collection('settings').doc('booking').get();
  const d = snap.data() || {};
  return {
    clientCancelWindowHours: d.clientCancelWindowHours ?? 12,
    staffCancelWindowHours: d.staffCancelWindowHours ?? 2,
    clientRescheduleWindowHours: d.clientRescheduleWindowHours ?? d.clientCancelWindowHours ?? 12,
    staffRescheduleWindowHours: d.staffRescheduleWindowHours ?? d.staffCancelWindowHours ?? 2,
    allowClientCancel: d.allowClientCancel !== false,
    allowClientReschedule: d.allowClientReschedule !== false,
  };
}

function canCancelByWindow(startAt: admin.firestore.Timestamp, windowHours: number): boolean {
  const start = startAt.toDate();
  const deadline = new Date(start);
  deadline.setHours(deadline.getHours() - windowHours);
  return new Date() <= deadline;
}

/**
 * Devuelve próximos turnos por DNI (solo datos necesarios para listado).
 */
export const getBookingsByDni = functions.https.onCall(
  async (request) => {
    try {
      const data = (request.data || {}) as { tenantId?: string; dni?: string };
      const tenantId = data.tenantId;
      const dni = data.dni != null ? String(data.dni).trim() : '';
      if (!tenantId || !dni || dni.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId and dni required');
      }
      const clientsSnap = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('clients')
        .where('dni', '==', dni)
        .limit(1)
        .get();
      if (clientsSnap.empty) {
        return { bookings: [], clientName: null };
      }
      const clientDoc = clientsSnap.docs[0];
      const clientData = clientDoc.data();
      const clientName = [clientData.firstName, clientData.lastName].filter(Boolean).join(' ') || null;
      const clientId = clientDoc.id;
      const today = new Date().toISOString().slice(0, 10);
      const bookingsRef = db.collection('tenants').doc(tenantId).collection('bookings');
      const bookingsSnap = await bookingsRef
        .where('clientId', '==', clientId)
        .where('date', '>=', today)
        .orderBy('date', 'asc')
        .orderBy('startTime', 'asc')
        .get();
      const bookings = bookingsSnap.docs
        .filter((d) => (d.data().status ?? '') !== 'cancelled')
        .map((d) => {
          const x = d.data();
          return {
            id: d.id,
            date: x.date,
            startTime: x.startTime,
            endTime: x.endTime,
            status: x.status ?? 'confirmed',
            staffName: x.staffName,
            servicesSnapshot: x.servicesSnapshot ?? [],
            totalDurationMinutes: x.totalDurationMinutes,
            totalPrice: x.totalPrice,
          };
        });
      return { bookings, clientName };
    } catch (err: any) {
      if (err instanceof functions.https.HttpsError) throw err;
      functions.logger.error('getBookingsByDni error', err);
      throw new functions.https.HttpsError('internal', err?.message ?? 'Error al buscar turnos');
    }
  }
);

/**
 * Valida token de gestión pública y devuelve el turno (sanitized) para la página /manage.
 */
export const validateManageToken = functions.https.onCall(
  async (request) => {
    const data = (request.data || {}) as { tenantId?: string; bookingId?: string; token?: string };
    const { tenantId, bookingId, token } = data;
    if (!tenantId || !bookingId || !token || String(token).trim().length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'tenantId, bookingId and token required');
    }
    const bookingSnap = await db.collection('tenants').doc(tenantId).collection('bookings').doc(bookingId).get();
    if (!bookingSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Turno no encontrado');
    }
    const b = bookingSnap.data()!;
    if ((b.publicManageToken ?? '') !== String(token).trim()) {
      throw new functions.https.HttpsError('permission-denied', 'Token inválido');
    }
    if ((b.status ?? '') === 'cancelled') {
      throw new functions.https.HttpsError('failed-precondition', 'Este turno ya está cancelado');
    }
    const tenantSnap = await db.collection('tenants').doc(tenantId).get();
    const tenantName = (tenantSnap.data() as any)?.name ?? '';
    const settings = await getTenantBookingSettings(tenantId);
    const startAt = b.startAt as admin.firestore.Timestamp;
    const canCancel = settings.allowClientCancel && startAt && canCancelByWindow(startAt, settings.clientCancelWindowHours);
    const canReschedule = settings.allowClientReschedule && startAt && canCancelByWindow(startAt, settings.clientRescheduleWindowHours);
    return {
      bookingId,
      staffId: b.staffId ?? '',
      date: b.date,
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status ?? 'confirmed',
      staffName: b.staffName,
      servicesSnapshot: b.servicesSnapshot ?? [],
      totalDurationMinutes: b.totalDurationMinutes ?? 0,
      tenantName,
      canCancel,
      canReschedule,
    };
  }
);

/**
 * Cancelación pública por token.
 */
export const cancelBookingPublic = functions.https.onCall(
  async (request) => {
    const data = (request.data || {}) as { tenantId?: string; bookingId?: string; token?: string; reason?: string };
    const { tenantId, bookingId, token, reason } = data;
    if (!tenantId || !bookingId || !token || String(token).trim().length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'tenantId, bookingId and token required');
    }
    const bookingRef = db.collection('tenants').doc(tenantId).collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Turno no encontrado');
    }
    const b = bookingSnap.data()!;
    if ((b.publicManageToken ?? '') !== String(token).trim()) {
      throw new functions.https.HttpsError('permission-denied', 'Token inválido');
    }
    if ((b.status ?? '') === 'cancelled') {
      throw new functions.https.HttpsError('failed-precondition', 'Este turno ya está cancelado');
    }
    const settings = await getTenantBookingSettings(tenantId);
    if (!settings.allowClientCancel) {
      throw new functions.https.HttpsError('failed-precondition', 'La cancelación por cliente no está permitida');
    }
    const startAt = b.startAt as admin.firestore.Timestamp;
    if (!startAt || !canCancelByWindow(startAt, settings.clientCancelWindowHours)) {
      throw new functions.https.HttpsError('failed-precondition', 'Ya pasó la ventana para cancelar');
    }
    const staffId = b.staffId ?? '';
    const date = b.date ?? '';
    const startTime = b.startTime ?? '';
    const endTime = b.endTime ?? '';
    const lockId = `${staffId}_${date}`;
    const slotStateRef = db.collection('tenants').doc(tenantId).collection('slotState').doc(lockId);
    const prevStatus = b.status ?? 'confirmed';
    const historyEntry = { at: admin.firestore.FieldValue.serverTimestamp(), from: prevStatus, to: 'cancelled', by: { type: 'client' }, note: reason ?? '' };

    await db.runTransaction(async (tx) => {
      const slotStateSnap = await tx.get(slotStateRef);
      const slots: Array<{ startTime: string; endTime: string }> = slotStateSnap.exists ? (slotStateSnap.data()?.slots ?? []) : [];
      const newSlots = slots.filter((s) => !(s.startTime === startTime && s.endTime === endTime));
      if (slotStateSnap.exists) {
        tx.update(slotStateRef, { slots: newSlots, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      tx.update(bookingRef, {
        status: 'cancelled',
        cancelReason: reason ?? null,
        canceledAt: admin.firestore.FieldValue.serverTimestamp(),
        canceledBy: { type: 'client' },
        statusHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    return { success: true, message: 'Turno cancelado' };
  }
);

/**
 * Reprogramación pública por token.
 */
export const rescheduleBookingPublic = functions.https.onCall(
  async (request) => {
    const data = (request.data || {}) as { tenantId?: string; bookingId?: string; token?: string; newDate?: string; newStartTime?: string; newEndTime?: string };
    const { tenantId, bookingId, token, newDate, newStartTime, newEndTime } = data;
    if (!tenantId || !bookingId || !token || !newDate || !newStartTime || !newEndTime) {
      throw new functions.https.HttpsError('invalid-argument', 'tenantId, bookingId, token, newDate, newStartTime, newEndTime required');
    }
    const bookingRef = db.collection('tenants').doc(tenantId).collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Turno no encontrado');
    }
    const b = bookingSnap.data()!;
    if ((b.publicManageToken ?? '') !== String(token).trim()) {
      throw new functions.https.HttpsError('permission-denied', 'Token inválido');
    }
    if ((b.status ?? '') !== 'confirmed') {
      throw new functions.https.HttpsError('failed-precondition', 'Solo se puede reprogramar un turno confirmado');
    }
    const settings = await getTenantBookingSettings(tenantId);
    if (!settings.allowClientReschedule) {
      throw new functions.https.HttpsError('failed-precondition', 'La reprogramación por cliente no está permitida');
    }
    const startAt = b.startAt as admin.firestore.Timestamp;
    if (!startAt || !canCancelByWindow(startAt, settings.clientRescheduleWindowHours)) {
      throw new functions.https.HttpsError('failed-precondition', 'Ya pasó la ventana para reprogramar');
    }
    const today = new Date().toISOString().slice(0, 10);
    if (newDate < today) {
      throw new functions.https.HttpsError('invalid-argument', 'La nueva fecha no puede ser pasada');
    }
    const staffId = b.staffId ?? '';
    const oldDate = b.date ?? '';
    const oldStart = b.startTime ?? '';
    const oldEnd = b.endTime ?? '';
    const oldLockId = `${staffId}_${oldDate}`;
    const newLockId = `${staffId}_${newDate}`;
    const oldSlotStateRef = db.collection('tenants').doc(tenantId).collection('slotState').doc(oldLockId);
    const newSlotStateRef = db.collection('tenants').doc(tenantId).collection('slotState').doc(newLockId);
    const newStartAt = new Date(`${newDate}T${newStartTime}:00`);
    const newEndAt = new Date(`${newDate}T${newEndTime}:00`);
    const historyEntry = { at: admin.firestore.FieldValue.serverTimestamp(), from: 'confirmed', to: 'confirmed', by: { type: 'client' }, note: 'rescheduled' };

    await db.runTransaction(async (tx) => {
      const oldSnap = await tx.get(oldSlotStateRef);
      const oldSlots: Array<{ startTime: string; endTime: string }> = oldSnap.exists ? (oldSnap.data()?.slots ?? []) : [];
      const withoutOld = oldSlots.filter((s) => !(s.startTime === oldStart && s.endTime === oldEnd));
      if (oldSnap.exists) {
        tx.update(oldSlotStateRef, { slots: withoutOld, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      const newSnap = await tx.get(newSlotStateRef);
      let newSlots: Array<{ startTime: string; endTime: string }> = newSnap.exists ? (newSnap.data()?.slots ?? []) : [];
      const overlap = newSlots.some((s) => s.startTime === newStartTime && s.endTime === newEndTime);
      if (overlap) {
        throw new functions.https.HttpsError('failed-precondition', 'SLOT_TAKEN');
      }
      newSlots.push({ startTime: newStartTime, endTime: newEndTime });
      if (newSnap.exists) {
        tx.update(newSlotStateRef, { slots: newSlots, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        tx.set(newSlotStateRef, { staffId, date: newDate, slots: newSlots, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      tx.update(bookingRef, {
        date: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        startAt: admin.firestore.Timestamp.fromDate(newStartAt),
        endAt: admin.firestore.Timestamp.fromDate(newEndAt),
        rescheduledAt: admin.firestore.FieldValue.serverTimestamp(),
        statusHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    return { success: true, message: 'Turno reprogramado' };
  }
);

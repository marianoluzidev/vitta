"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.rescheduleBookingPublic = exports.cancelBookingPublic = exports.validateManageToken = exports.getBookingsByDni = exports.createPublicBooking = exports.findClientByDni = exports.getAvailableSlots = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
function parseTime(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return (h !== null && h !== void 0 ? h : 0) * 60 + (m !== null && m !== void 0 ? m : 0);
}
function minutesToTime(min) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function getWeekdayFromDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return DAY_KEYS[d.getDay()];
}
function mergeIntervals(intervals) {
    if (intervals.length <= 1)
        return intervals;
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    const out = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
        const last = out[out.length - 1];
        if (sorted[i].start <= last.end)
            last.end = Math.max(last.end, sorted[i].end);
        else
            out.push({ ...sorted[i] });
    }
    return out;
}
function subtractIntervals(open, busy) {
    let result = open.map((i) => ({ ...i }));
    for (const b of busy) {
        const next = [];
        for (const a of result) {
            if (b.end <= a.start || b.start >= a.end)
                next.push(a);
            else {
                if (a.start < b.start)
                    next.push({ start: a.start, end: b.start });
                if (b.end < a.end)
                    next.push({ start: b.end, end: a.end });
            }
        }
        result = mergeIntervals(next);
    }
    return result;
}
function openFromBlocks(blocks) {
    const open = [];
    for (const block of blocks) {
        const start = parseTime(block.start);
        const end = parseTime(block.end);
        const breakInts = (block.breaks || []).map((br) => ({
            start: parseTime(br.start),
            end: parseTime(br.end),
        }));
        const free = subtractIntervals([{ start, end }], breakInts);
        open.push(...free);
    }
    return mergeIntervals(open);
}
function blockedFromBreaks(blocks) {
    const out = [];
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
exports.getAvailableSlots = functions.https.onCall(async (request) => {
    var _a, _b, _c;
    const data = request.data;
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
    const staffData = staffSnap.data();
    const schedule = ((_a = staffData.schedule) !== null && _a !== void 0 ? _a : {});
    const dayEnabled = ((_b = staffData.dayEnabled) !== null && _b !== void 0 ? _b : {});
    const day = getWeekdayFromDate(date);
    const blocks = (_c = schedule[day]) !== null && _c !== void 0 ? _c : [];
    if (dayEnabled[day] === false || blocks.length === 0) {
        return { slots: [] };
    }
    const open = openFromBlocks(blocks);
    const blockedByBreaks = blockedFromBreaks(blocks);
    const exceptionsSnap = await staffRef.collection('exceptions').where('date', '==', date).get();
    const blockedByExceptions = [];
    exceptionsSnap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.type === 'full_day')
            blockedByExceptions.push({ start: 0, end: 24 * 60 });
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
    const blockedByBookings = bookingsSnap.docs
        .filter((d) => { var _a; return ((_a = d.data().status) !== null && _a !== void 0 ? _a : '') !== 'cancelled'; })
        .map((d) => {
        var _a, _b;
        const x = d.data();
        return { start: parseTime((_a = x.startTime) !== null && _a !== void 0 ? _a : '00:00'), end: parseTime((_b = x.endTime) !== null && _b !== void 0 ? _b : '00:00') };
    });
    const allBlocked = mergeIntervals([...blockedByBreaks, ...blockedByExceptions, ...blockedByBookings]);
    const free = subtractIntervals(open, allBlocked);
    const slots = [];
    for (const iv of free) {
        let t = iv.start;
        while (t + durationMinutes <= iv.end) {
            const endMin = t + durationMinutes;
            const overlaps = allBlocked.some((b) => t < b.end && endMin > b.start);
            if (!overlaps)
                slots.push({ start: minutesToTime(t), end: minutesToTime(endMin) });
            t += STEP;
        }
    }
    return { slots };
});
/**
 * Busca cliente por DNI (solo devuelve datos para autocompletar formulario).
 */
exports.findClientByDni = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d;
    const data = request.data;
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
    if (clientsSnap.empty)
        return null;
    const doc = clientsSnap.docs[0];
    const d = doc.data();
    return {
        clientId: doc.id,
        firstName: (_a = d.firstName) !== null && _a !== void 0 ? _a : '',
        lastName: (_b = d.lastName) !== null && _b !== void 0 ? _b : '',
        phone: (_c = d.phone) !== null && _c !== void 0 ? _c : '',
        email: (_d = d.email) !== null && _d !== void 0 ? _d : '',
    };
});
/**
 * Crea reserva pública: cliente (create/update) + booking + slotState. Opcional: envía email.
 */
exports.createPublicBooking = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d;
    const data = request.data;
    const { tenantId, payload } = data;
    if (!tenantId || !(payload === null || payload === void 0 ? void 0 : payload.staffId) || !(payload === null || payload === void 0 ? void 0 : payload.date) || !(payload === null || payload === void 0 ? void 0 : payload.startTime) || !(payload === null || payload === void 0 ? void 0 : payload.endTime) || !((_a = payload === null || payload === void 0 ? void 0 : payload.client) === null || _a === void 0 ? void 0 : _a.dni)) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
    }
    const tenantRef = db.collection('tenants').doc(tenantId);
    const tenantSnap = await tenantRef.get();
    if (!tenantSnap.exists || ((_b = tenantSnap.data()) === null || _b === void 0 ? void 0 : _b.isActive) === false) {
        throw new functions.https.HttpsError('failed-precondition', 'Tenant not found or inactive');
    }
    const servicesSnap = await tenantRef.collection('services').get();
    const servicesMap = new Map(servicesSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
    const staffSnap = await tenantRef.collection('staff').doc(payload.staffId).get();
    if (!staffSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Staff not found');
    }
    const staffData = staffSnap.data();
    const staffName = [staffData.firstName, staffData.lastName].filter(Boolean).join(' ') || 'Staff';
    const servicesSnapshot = payload.serviceIds
        .map((id) => servicesMap.get(id))
        .filter(Boolean)
        .map((s) => {
        var _a, _b;
        return ({
            id: s.id,
            name: s.name,
            price: (_a = s.price) !== null && _a !== void 0 ? _a : 0,
            durationMinutes: (_b = s.durationMinutes) !== null && _b !== void 0 ? _b : 0,
        });
    });
    const totalDuration = servicesSnapshot.reduce((acc, s) => { var _a; return acc + ((_a = s.durationMinutes) !== null && _a !== void 0 ? _a : 0); }, 0);
    const totalPrice = servicesSnapshot.reduce((acc, s) => { var _a; return acc + ((_a = s.price) !== null && _a !== void 0 ? _a : 0); }, 0);
    const dni = String(payload.client.dni).trim();
    const clientsRef = tenantRef.collection('clients');
    let clientId;
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
    }
    else {
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
    const statusHistory = [{ at: now, from: '', to: 'pending', by: { type: 'client' }, note: 'created' }];
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
        status: 'pending',
        source: 'public',
        publicManageToken,
        statusHistory,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.runTransaction(async (tx) => {
        var _a, _b;
        const lockSnap = await tx.get(lockRef);
        const slotStateSnap = await tx.get(slotStateRef);
        const slots = slotStateSnap.exists
            ? ((_b = (_a = slotStateSnap.data()) === null || _a === void 0 ? void 0 : _a.slots) !== null && _b !== void 0 ? _b : [])
            : [];
        const overlaps = slots.some((s) => parseTime(s.startTime) < parseTime(payload.endTime) &&
            parseTime(s.endTime) > parseTime(payload.startTime));
        if (overlaps) {
            throw new functions.https.HttpsError('failed-precondition', 'SLOT_TAKEN');
        }
        if (!lockSnap.exists) {
            tx.set(lockRef, { staffId: payload.staffId, date: payload.date, updatedAt: admin.firestore.FieldValue.serverTimestamp(), version: 1 });
        }
        else {
            tx.update(lockRef, { updatedAt: admin.firestore.FieldValue.serverTimestamp(), version: admin.firestore.FieldValue.increment(1) });
        }
        const newSlot = { startTime: payload.startTime, endTime: payload.endTime };
        if (!slotStateSnap.exists) {
            tx.set(slotStateRef, { staffId: payload.staffId, date: payload.date, slots: [newSlot], updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        else {
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
            await sendBookingConfirmationEmail(tenantId, bookingId, (_d = (_c = tenantSnap.data()) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : 'Local', publicManageToken);
        }
        catch (e) {
            functions.logger.warn('Email send failed', e);
        }
    }
    return { success: true, bookingId, message: 'Reserva confirmada' };
});
async function sendBookingConfirmationEmail(tenantId, bookingId, tenantName, manageToken) {
    var _a;
    const bookingSnap = await db.collection('tenants').doc(tenantId).collection('bookings').doc(bookingId).get();
    if (!bookingSnap.exists)
        return;
    const b = bookingSnap.data();
    const email = (_a = b.clientSnapshot) === null || _a === void 0 ? void 0 : _a.email;
    if (!email)
        return;
    const manageUrl = manageToken ? `https://YOUR_APP_URL/t/${tenantId}/manage/${bookingId}/?token=${manageToken}` : '';
    // Placeholder: en producción conectar SendGrid/Mailgun/nodemailer e incluir manageUrl en el cuerpo
    functions.logger.info('Would send confirmation email', { to: email, tenantName, date: b.date, startTime: b.startTime, manageUrl });
}
async function getTenantBookingSettings(tenantId) {
    var _a, _b, _c, _d, _e, _f;
    const snap = await db.collection('tenants').doc(tenantId).collection('settings').doc('booking').get();
    const d = snap.data() || {};
    return {
        clientCancelWindowHours: (_a = d.clientCancelWindowHours) !== null && _a !== void 0 ? _a : 12,
        staffCancelWindowHours: (_b = d.staffCancelWindowHours) !== null && _b !== void 0 ? _b : 2,
        clientRescheduleWindowHours: (_d = (_c = d.clientRescheduleWindowHours) !== null && _c !== void 0 ? _c : d.clientCancelWindowHours) !== null && _d !== void 0 ? _d : 12,
        staffRescheduleWindowHours: (_f = (_e = d.staffRescheduleWindowHours) !== null && _e !== void 0 ? _e : d.staffCancelWindowHours) !== null && _f !== void 0 ? _f : 2,
        allowClientCancel: d.allowClientCancel !== false,
        allowClientReschedule: d.allowClientReschedule !== false,
    };
}
function canCancelByWindow(startAt, windowHours) {
    const start = startAt.toDate();
    const deadline = new Date(start);
    deadline.setHours(deadline.getHours() - windowHours);
    return new Date() <= deadline;
}
/**
 * Devuelve próximos turnos por DNI (solo datos necesarios para listado).
 */
exports.getBookingsByDni = functions.https.onCall(async (request) => {
    var _a;
    try {
        const data = (request.data || {});
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
            .filter((d) => { var _a; return ((_a = d.data().status) !== null && _a !== void 0 ? _a : '') !== 'cancelled'; })
            .map((d) => {
            var _a, _b;
            const x = d.data();
            return {
                id: d.id,
                date: x.date,
                startTime: x.startTime,
                endTime: x.endTime,
                status: (_a = x.status) !== null && _a !== void 0 ? _a : 'confirmed',
                staffName: x.staffName,
                servicesSnapshot: (_b = x.servicesSnapshot) !== null && _b !== void 0 ? _b : [],
                totalDurationMinutes: x.totalDurationMinutes,
                totalPrice: x.totalPrice,
            };
        });
        return { bookings, clientName };
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError)
            throw err;
        functions.logger.error('getBookingsByDni error', err);
        throw new functions.https.HttpsError('internal', (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : 'Error al buscar turnos');
    }
});
/**
 * Valida token de gestión pública y devuelve el turno (sanitized) para la página /manage.
 */
exports.validateManageToken = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const data = (request.data || {});
    const { tenantId, bookingId, token } = data;
    if (!tenantId || !bookingId || !token || String(token).trim().length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId, bookingId and token required');
    }
    const bookingSnap = await db.collection('tenants').doc(tenantId).collection('bookings').doc(bookingId).get();
    if (!bookingSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Turno no encontrado');
    }
    const b = bookingSnap.data();
    if (((_a = b.publicManageToken) !== null && _a !== void 0 ? _a : '') !== String(token).trim()) {
        throw new functions.https.HttpsError('permission-denied', 'Token inválido');
    }
    if (((_b = b.status) !== null && _b !== void 0 ? _b : '') === 'cancelled') {
        throw new functions.https.HttpsError('failed-precondition', 'Este turno ya está cancelado');
    }
    const tenantSnap = await db.collection('tenants').doc(tenantId).get();
    const tenantName = (_d = (_c = tenantSnap.data()) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : '';
    const settings = await getTenantBookingSettings(tenantId);
    const startAt = b.startAt;
    const canCancel = settings.allowClientCancel && startAt && canCancelByWindow(startAt, settings.clientCancelWindowHours);
    const canReschedule = settings.allowClientReschedule && startAt && canCancelByWindow(startAt, settings.clientRescheduleWindowHours);
    return {
        bookingId,
        staffId: (_e = b.staffId) !== null && _e !== void 0 ? _e : '',
        date: b.date,
        startTime: b.startTime,
        endTime: b.endTime,
        status: (_f = b.status) !== null && _f !== void 0 ? _f : 'confirmed',
        staffName: b.staffName,
        servicesSnapshot: (_g = b.servicesSnapshot) !== null && _g !== void 0 ? _g : [],
        totalDurationMinutes: (_h = b.totalDurationMinutes) !== null && _h !== void 0 ? _h : 0,
        tenantName,
        canCancel,
        canReschedule,
    };
});
/**
 * Cancelación pública por token.
 */
exports.cancelBookingPublic = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const data = (request.data || {});
    const { tenantId, bookingId, token, reason } = data;
    if (!tenantId || !bookingId || !token || String(token).trim().length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId, bookingId and token required');
    }
    const bookingRef = db.collection('tenants').doc(tenantId).collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Turno no encontrado');
    }
    const b = bookingSnap.data();
    if (((_a = b.publicManageToken) !== null && _a !== void 0 ? _a : '') !== String(token).trim()) {
        throw new functions.https.HttpsError('permission-denied', 'Token inválido');
    }
    if (((_b = b.status) !== null && _b !== void 0 ? _b : '') === 'cancelled') {
        throw new functions.https.HttpsError('failed-precondition', 'Este turno ya está cancelado');
    }
    const settings = await getTenantBookingSettings(tenantId);
    if (!settings.allowClientCancel) {
        throw new functions.https.HttpsError('failed-precondition', 'La cancelación por cliente no está permitida');
    }
    const startAt = b.startAt;
    if (!startAt || !canCancelByWindow(startAt, settings.clientCancelWindowHours)) {
        throw new functions.https.HttpsError('failed-precondition', 'Ya pasó la ventana para cancelar');
    }
    const staffId = (_c = b.staffId) !== null && _c !== void 0 ? _c : '';
    const date = (_d = b.date) !== null && _d !== void 0 ? _d : '';
    const startTime = (_e = b.startTime) !== null && _e !== void 0 ? _e : '';
    const endTime = (_f = b.endTime) !== null && _f !== void 0 ? _f : '';
    const lockId = `${staffId}_${date}`;
    const slotStateRef = db.collection('tenants').doc(tenantId).collection('slotState').doc(lockId);
    const prevStatus = (_g = b.status) !== null && _g !== void 0 ? _g : 'confirmed';
    const historyEntry = { at: admin.firestore.FieldValue.serverTimestamp(), from: prevStatus, to: 'cancelled', by: { type: 'client' }, note: reason !== null && reason !== void 0 ? reason : '' };
    await db.runTransaction(async (tx) => {
        var _a, _b;
        const slotStateSnap = await tx.get(slotStateRef);
        const slots = slotStateSnap.exists ? ((_b = (_a = slotStateSnap.data()) === null || _a === void 0 ? void 0 : _a.slots) !== null && _b !== void 0 ? _b : []) : [];
        const newSlots = slots.filter((s) => !(s.startTime === startTime && s.endTime === endTime));
        if (slotStateSnap.exists) {
            tx.update(slotStateRef, { slots: newSlots, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        tx.update(bookingRef, {
            status: 'cancelled',
            cancelReason: reason !== null && reason !== void 0 ? reason : null,
            canceledAt: admin.firestore.FieldValue.serverTimestamp(),
            canceledBy: { type: 'client' },
            statusHistory: admin.firestore.FieldValue.arrayUnion(historyEntry),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });
    return { success: true, message: 'Turno cancelado' };
});
/**
 * Reprogramación pública por token.
 */
exports.rescheduleBookingPublic = functions.https.onCall(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const data = (request.data || {});
    const { tenantId, bookingId, token, newDate, newStartTime, newEndTime } = data;
    if (!tenantId || !bookingId || !token || !newDate || !newStartTime || !newEndTime) {
        throw new functions.https.HttpsError('invalid-argument', 'tenantId, bookingId, token, newDate, newStartTime, newEndTime required');
    }
    const bookingRef = db.collection('tenants').doc(tenantId).collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Turno no encontrado');
    }
    const b = bookingSnap.data();
    if (((_a = b.publicManageToken) !== null && _a !== void 0 ? _a : '') !== String(token).trim()) {
        throw new functions.https.HttpsError('permission-denied', 'Token inválido');
    }
    const status = (_b = b.status) !== null && _b !== void 0 ? _b : '';
    if (status !== 'confirmed' && status !== 'pending') {
        throw new functions.https.HttpsError('failed-precondition', 'Solo se puede reprogramar un turno confirmado o pendiente');
    }
    const settings = await getTenantBookingSettings(tenantId);
    if (!settings.allowClientReschedule) {
        throw new functions.https.HttpsError('failed-precondition', 'La reprogramación por cliente no está permitida');
    }
    const startAt = b.startAt;
    if (!startAt || !canCancelByWindow(startAt, settings.clientRescheduleWindowHours)) {
        throw new functions.https.HttpsError('failed-precondition', 'Ya pasó la ventana para reprogramar');
    }
    const today = new Date().toISOString().slice(0, 10);
    if (newDate < today) {
        throw new functions.https.HttpsError('invalid-argument', 'La nueva fecha no puede ser pasada');
    }
    const staffId = (_c = b.staffId) !== null && _c !== void 0 ? _c : '';
    const oldDate = (_d = b.date) !== null && _d !== void 0 ? _d : '';
    const oldStart = (_e = b.startTime) !== null && _e !== void 0 ? _e : '';
    const oldEnd = (_f = b.endTime) !== null && _f !== void 0 ? _f : '';
    const oldLockId = `${staffId}_${oldDate}`;
    const newLockId = `${staffId}_${newDate}`;
    const oldSlotStateRef = db.collection('tenants').doc(tenantId).collection('slotState').doc(oldLockId);
    const newSlotStateRef = db.collection('tenants').doc(tenantId).collection('slotState').doc(newLockId);
    const newStartAt = new Date(`${newDate}T${newStartTime}:00`);
    const newEndAt = new Date(`${newDate}T${newEndTime}:00`);
    const prevStatus = (_g = b.status) !== null && _g !== void 0 ? _g : 'pending';
    const historyEntry = { at: admin.firestore.FieldValue.serverTimestamp(), from: prevStatus, to: prevStatus, by: { type: 'client' }, note: 'rescheduled' };
    await db.runTransaction(async (tx) => {
        var _a, _b, _c, _d;
        const oldSnap = await tx.get(oldSlotStateRef);
        const oldSlots = oldSnap.exists ? ((_b = (_a = oldSnap.data()) === null || _a === void 0 ? void 0 : _a.slots) !== null && _b !== void 0 ? _b : []) : [];
        const withoutOld = oldSlots.filter((s) => !(s.startTime === oldStart && s.endTime === oldEnd));
        if (oldSnap.exists) {
            tx.update(oldSlotStateRef, { slots: withoutOld, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        const newSnap = await tx.get(newSlotStateRef);
        let newSlots = newSnap.exists ? ((_d = (_c = newSnap.data()) === null || _c === void 0 ? void 0 : _c.slots) !== null && _d !== void 0 ? _d : []) : [];
        const overlap = newSlots.some((s) => s.startTime === newStartTime && s.endTime === newEndTime);
        if (overlap) {
            throw new functions.https.HttpsError('failed-precondition', 'SLOT_TAKEN');
        }
        newSlots.push({ startTime: newStartTime, endTime: newEndTime });
        if (newSnap.exists) {
            tx.update(newSlotStateRef, { slots: newSlots, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        else {
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
});
//# sourceMappingURL=index.js.map
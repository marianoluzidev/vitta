import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/app';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'no-show';

export interface Appointment {
  id: string;
  salonId: string;
  employeeId: string;
  serviceIds: string[];
  clientName: string;
  clientPhone: string;
  clientId?: string; // Optional link to clients collection
  start: string;
  end: string;
  status: AppointmentStatus;
}

export interface CreateAppointmentPayload {
  salonId: string;
  employeeId: string;
  serviceIds: string[];
  clientName: string;
  clientPhone: string;
  clientId?: string; // Optional link to clients collection
  start: string; // ISO string
  end: string; // ISO string
  status?: AppointmentStatus; // default 'confirmed'
}

export async function getAppointmentsBySalonIdAndDate(
  salonId: string,
  date: Date
): Promise<Appointment[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return getAppointmentsBySalonIdAndDateRange(salonId, startOfDay, endOfDay);
}

export async function getAppointmentsBySalonIdAndDateRange(
  salonId: string,
  startDate: Date,
  endDate: Date
): Promise<Appointment[]> {
  const startOfRange = new Date(startDate);
  startOfRange.setHours(0, 0, 0, 0);
  const endOfRange = new Date(endDate);
  endOfRange.setHours(23, 59, 59, 999);

  const appointmentsRef = collection(db, 'appointments');
  const q = query(
    appointmentsRef,
    where('salonId', '==', salonId),
    where('start', '>=', Timestamp.fromDate(startOfRange)),
    where('start', '<=', Timestamp.fromDate(endOfRange)),
    orderBy('start', 'asc')
  );

  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      salonId: data.salonId,
      employeeId: data.employeeId,
      serviceIds: data.serviceIds || (data.serviceId ? [data.serviceId] : []), // Support migration from old format
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      clientId: data.clientId || undefined,
      start: data.start instanceof Timestamp ? data.start.toDate().toISOString() : data.start,
      end: data.end instanceof Timestamp ? data.end.toDate().toISOString() : data.end,
      status: data.status,
    };
  }) as Appointment[];
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const appointmentRef = doc(db, 'appointments', id);
  const appointmentSnap = await getDoc(appointmentRef);

  if (!appointmentSnap.exists()) {
    return null;
  }

  const data = appointmentSnap.data();
  return {
    id: appointmentSnap.id,
    salonId: data.salonId,
    employeeId: data.employeeId,
    serviceIds: data.serviceIds || (data.serviceId ? [data.serviceId] : []), // Support migration from old format
    clientName: data.clientName,
    clientPhone: data.clientPhone,
    clientId: data.clientId || undefined,
    start: data.start instanceof Timestamp ? data.start.toDate().toISOString() : data.start,
    end: data.end instanceof Timestamp ? data.end.toDate().toISOString() : data.end,
    status: data.status,
  } as Appointment;
}

export async function createAppointment(payload: CreateAppointmentPayload): Promise<void> {
  const appointmentsRef = collection(db, 'appointments');
  await addDoc(appointmentsRef, {
    salonId: payload.salonId,
    employeeId: payload.employeeId,
    serviceIds: payload.serviceIds,
    clientName: payload.clientName,
    clientPhone: payload.clientPhone,
    clientId: payload.clientId || null,
    start: Timestamp.fromDate(new Date(payload.start)),
    end: Timestamp.fromDate(new Date(payload.end)),
    status: payload.status || 'confirmed',
    createdAt: serverTimestamp(),
  });
}

export async function updateAppointment(
  id: string,
  payload: Partial<CreateAppointmentPayload>
): Promise<void> {
  const appointmentRef = doc(db, 'appointments', id);
  const updateData: any = {};

  if (payload.employeeId !== undefined) updateData.employeeId = payload.employeeId;
  if (payload.serviceIds !== undefined) updateData.serviceIds = payload.serviceIds;
  if (payload.clientName !== undefined) updateData.clientName = payload.clientName;
  if (payload.clientPhone !== undefined) updateData.clientPhone = payload.clientPhone;
  if (payload.clientId !== undefined) updateData.clientId = payload.clientId || null;
  if (payload.start !== undefined) updateData.start = Timestamp.fromDate(new Date(payload.start));
  if (payload.end !== undefined) updateData.end = Timestamp.fromDate(new Date(payload.end));
  if (payload.status !== undefined) updateData.status = payload.status;

  await updateDoc(appointmentRef, updateData);
}

/**
 * Check if there are overlapping appointments for a given employee and time range
 * Excludes cancelled and no-show appointments from overlap check
 */
export async function checkOverlappingAppointments(
  salonId: string,
  employeeId: string,
  start: string,
  end: string,
  excludeAppointmentId?: string // Optional: exclude this appointment ID (useful for updates)
): Promise<boolean> {
  const startTime = Timestamp.fromDate(new Date(start));
  const endTime = Timestamp.fromDate(new Date(end));

  const appointmentsRef = collection(db, 'appointments');
  // Query without status filter (Firestore requires composite index for 'in' queries with other filters)
  // We'll filter by status in memory
  const q = query(
    appointmentsRef,
    where('salonId', '==', salonId),
    where('employeeId', '==', employeeId),
    orderBy('start', 'asc')
  );

  const querySnapshot = await getDocs(q);

  for (const docSnap of querySnapshot.docs) {
    // Skip the appointment being updated
    if (excludeAppointmentId && docSnap.id === excludeAppointmentId) {
      continue;
    }

    const data = docSnap.data();
    
    // Only check active appointments (pending or confirmed)
    if (data.status !== 'pending' && data.status !== 'confirmed') {
      continue;
    }

    const existingStart = data.start instanceof Timestamp ? data.start : Timestamp.fromDate(new Date(data.start));
    const existingEnd = data.end instanceof Timestamp ? data.end : Timestamp.fromDate(new Date(data.end));

    // Check for overlap: new appointment overlaps if it starts before existing ends AND ends after existing starts
    if (startTime.toMillis() < existingEnd.toMillis() && endTime.toMillis() > existingStart.toMillis()) {
      return true; // Overlap found
    }
  }

  return false; // No overlap
}

export async function deleteAppointment(id: string): Promise<void> {
  const appointmentRef = doc(db, 'appointments', id);
  await deleteDoc(appointmentRef);
}


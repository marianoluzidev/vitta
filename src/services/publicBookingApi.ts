/**
 * API pública de reservas: llama a Cloud Functions (callables).
 * getAvailableSlots, createPublicBooking, getBookingsByDni, findClientByDni
 */

import { httpsCallable } from 'firebase/functions';
import { getFunctionsInstance } from '../firebase/firebase';

export interface SlotOption {
  start: string;
  end: string;
}

export interface CreatePublicBookingPayload {
  staffId: string;
  serviceIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  client: {
    dni: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
  };
}

export interface CreatePublicBookingResult {
  bookingId: string;
  success: boolean;
  message?: string;
}

export interface BookingSummary {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  staffName?: string;
  servicesSnapshot?: Array<{ name: string; durationMinutes: number }>;
  totalDurationMinutes?: number;
  totalPrice?: number;
}

export interface GetBookingsByDniResult {
  bookings: BookingSummary[];
  clientName?: string;
}


export async function getAvailableSlots(
  tenantId: string,
  staffId: string,
  date: string,
  durationMinutes: number
): Promise<SlotOption[]> {
  const fn = getFunctionsInstance();
  const call = httpsCallable<{ tenantId: string; staffId: string; date: string; durationMinutes: number }, { slots: SlotOption[] }>(
    fn,
    'getAvailableSlots'
  );
  const res = await call({ tenantId, staffId, date, durationMinutes });
  return (res.data?.slots ?? []) as SlotOption[];
}

export async function createPublicBooking(
  tenantId: string,
  payload: CreatePublicBookingPayload
): Promise<CreatePublicBookingResult> {
  const fn = getFunctionsInstance();
  const call = httpsCallable<{ tenantId: string; payload: CreatePublicBookingPayload }, CreatePublicBookingResult>(
    fn,
    'createPublicBooking'
  );
  const res = await call({ tenantId, payload });
  return res.data as CreatePublicBookingResult;
}

export async function getBookingsByDni(tenantId: string, dni: string): Promise<GetBookingsByDniResult> {
  const fn = getFunctionsInstance();
  const call = httpsCallable<{ tenantId: string; dni: string }, GetBookingsByDniResult>(fn, 'getBookingsByDni');
  const res = await call({ tenantId, dni: dni.trim() });
  return res.data as GetBookingsByDniResult;
}

export async function findClientByDni(tenantId: string, dni: string): Promise<{ clientId: string; firstName: string; lastName: string; phone: string; email: string } | null> {
  const fn = getFunctionsInstance();
  const call = httpsCallable<{ tenantId: string; dni: string }, { clientId: string; firstName: string; lastName: string; phone: string; email: string } | null>(
    fn,
    'findClientByDni'
  );
  const res = await call({ tenantId, dni: dni.trim() });
  return res.data ?? null;
}

export interface ManageBookingInfo {
  bookingId: string;
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  staffName?: string;
  servicesSnapshot: Array<{ name?: string; durationMinutes?: number }>;
  totalDurationMinutes: number;
  tenantName: string;
  canCancel: boolean;
  canReschedule: boolean;
}

export async function validateManageToken(tenantId: string, bookingId: string, token: string): Promise<ManageBookingInfo> {
  const fn = getFunctionsInstance();
  const call = httpsCallable<{ tenantId: string; bookingId: string; token: string }, ManageBookingInfo>(fn, 'validateManageToken');
  const res = await call({ tenantId, bookingId, token: token.trim() });
  return res.data as ManageBookingInfo;
}

export async function cancelBookingPublic(tenantId: string, bookingId: string, token: string, reason?: string): Promise<{ success: boolean; message?: string }> {
  const fn = getFunctionsInstance();
  const call = httpsCallable<{ tenantId: string; bookingId: string; token: string; reason?: string }, { success: boolean; message?: string }>(fn, 'cancelBookingPublic');
  const res = await call({ tenantId, bookingId, token: token.trim(), reason });
  return res.data as { success: boolean; message?: string };
}

export async function rescheduleBookingPublic(
  tenantId: string,
  bookingId: string,
  token: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string
): Promise<{ success: boolean; message?: string }> {
  const fn = getFunctionsInstance();
  const call = httpsCallable<
    { tenantId: string; bookingId: string; token: string; newDate: string; newStartTime: string; newEndTime: string },
    { success: boolean; message?: string }
  >(fn, 'rescheduleBookingPublic');
  const res = await call({ tenantId, bookingId, token: token.trim(), newDate, newStartTime, newEndTime });
  return res.data as { success: boolean; message?: string };
}

/**
 * Configuración de turnos por tenant (ventanas de cancelación/reprogramación).
 * Path: tenants/{tenantId}/settings/booking
 */

import { doc, getDoc } from 'firebase/firestore';
import { getDbInstance } from '../firebase/firebase';

export interface TenantBookingSettings {
  clientCancelWindowHours?: number;
  staffCancelWindowHours?: number;
  clientRescheduleWindowHours?: number;
  staffRescheduleWindowHours?: number;
  allowClientCancel?: boolean;
  allowClientReschedule?: boolean;
}

const DEFAULTS: Required<TenantBookingSettings> = {
  clientCancelWindowHours: 12,
  staffCancelWindowHours: 2,
  clientRescheduleWindowHours: 12,
  staffRescheduleWindowHours: 2,
  allowClientCancel: true,
  allowClientReschedule: true,
};

export async function getTenantBookingSettings(tenantId: string): Promise<Required<TenantBookingSettings>> {
  if (!tenantId) return DEFAULTS;
  const db = getDbInstance();
  const snap = await getDoc(doc(db, 'tenants', tenantId, 'settings', 'booking'));
  if (!snap.exists()) return DEFAULTS;
  const data = snap.data() as TenantBookingSettings;
  return {
    clientCancelWindowHours: data.clientCancelWindowHours ?? DEFAULTS.clientCancelWindowHours,
    staffCancelWindowHours: data.staffCancelWindowHours ?? DEFAULTS.staffCancelWindowHours,
    clientRescheduleWindowHours: data.clientRescheduleWindowHours ?? data.clientCancelWindowHours ?? DEFAULTS.clientRescheduleWindowHours,
    staffRescheduleWindowHours: data.staffRescheduleWindowHours ?? data.staffCancelWindowHours ?? DEFAULTS.staffRescheduleWindowHours,
    allowClientCancel: data.allowClientCancel ?? DEFAULTS.allowClientCancel,
    allowClientReschedule: data.allowClientReschedule ?? DEFAULTS.allowClientReschedule,
  };
}

/** Devuelve si ahora está dentro de la ventana para cancelar (now <= startAt - windowHours). */
export function canCancelByWindow(startAt: Date, windowHours: number): boolean {
  const deadline = new Date(startAt);
  deadline.setHours(deadline.getHours() - windowHours);
  return new Date() <= deadline;
}

/** Devuelve si ahora está dentro de la ventana para reprogramar. */
export function canRescheduleByWindow(startAt: Date, windowHours: number): boolean {
  return canCancelByWindow(startAt, windowHours);
}

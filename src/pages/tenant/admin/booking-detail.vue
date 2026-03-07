<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar title="Detalle del turno" :back-link="'Atrás'" :back-link-url="agendaUrl" />

    <f7-block v-if="errorMessage" strong inset class="booking-detail-error-block">
      <p class="booking-detail-error">{{ errorMessage }}</p>
    </f7-block>

    <f7-block v-if="loading" strong inset>
      <p>Cargando...</p>
    </f7-block>

    <template v-else-if="booking">
      <f7-block strong inset>
        <p class="booking-detail-date">{{ booking.date }}</p>
        <p class="booking-detail-time">{{ booking.startTime }} – {{ booking.endTime }}</p>
        <p>
          <span :class="statusBadgeClass">{{ statusLabel(booking.status) }}</span>
        </p>
      </f7-block>

      <f7-list strong inset>
        <f7-list-item title="Staff" :after="booking.staffName || '—'" />
        <f7-list-item title="Cliente" :after="customerLabel(bookingCustomer)" />
        <f7-list-item v-if="bookingCustomer?.dni" title="DNI" :after="bookingCustomer.dni" />
        <f7-list-item v-if="bookingCustomer?.phone" title="Teléfono" :after="bookingCustomer.phone" />
        <f7-list-item v-if="bookingCustomer?.email" title="Email" :after="bookingCustomer.email" />
      </f7-list>

      <f7-block v-if="booking.servicesSnapshot?.length" strong inset>
        <p class="block-title">Servicios</p>
        <ul class="booking-detail-services">
          <li v-for="(svc, i) in booking.servicesSnapshot" :key="i">
            {{ svc.name || '—' }}{{ svc.durationMinutes != null ? ` (${svc.durationMinutes} min)` : '' }}
          </li>
        </ul>
      </f7-block>

      <f7-list strong inset>
        <f7-list-item title="Duración total" :after="`${booking.totalDurationMinutes ?? 0} min`" />
        <f7-list-item title="Total" :after="formatPrice(booking.totalPrice)" />
      </f7-list>

      <f7-block v-if="booking.notes" strong inset>
        <p class="block-title">Notas</p>
        <p class="booking-detail-notes">{{ booking.notes }}</p>
      </f7-block>

      <f7-block v-if="booking.createdAt || booking.updatedAt" strong inset class="booking-detail-meta">
        <p v-if="booking.createdAt">Creado: {{ formatTimestamp(booking.createdAt) }}</p>
        <p v-if="booking.updatedAt">Actualizado: {{ formatTimestamp(booking.updatedAt) }}</p>
      </f7-block>

      <!-- Actions: only when not already completed/cancelled/no_show -->
      <f7-block v-if="canChangeStatus" strong inset>
        <p class="block-title">Acciones</p>
        <f7-button v-if="isPending" fill small :disabled="saving" @click="setConfirmed">Confirmar turno</f7-button>
        <f7-button fill small :disabled="saving" class="margin-top" @click="setCompleted">Marcar como completado</f7-button>
        <f7-button class="margin-top" fill small :disabled="saving" @click="setNoShow">Marcar no show</f7-button>
        <f7-button v-if="!showCancelForm && canCancelByDeadline" class="margin-top" fill small :disabled="saving" @click="showCancelForm = true">Cancelar turno</f7-button>
        <p v-else-if="canChangeStatus && !canCancelByDeadline" class="booking-detail-window-msg">Ya no se puede cancelar (ventana de {{ bookingSettings.staffCancelWindowHours }} h antes).</p>

        <f7-button v-if="canRescheduleByDeadline" class="margin-top" fill small :disabled="saving" @click="showRescheduleModal = true">Reprogramar</f7-button>
        <p v-else-if="canChangeStatus && !canRescheduleByDeadline" class="booking-detail-window-msg">Ya no se puede reprogramar (ventana de {{ bookingSettings.staffRescheduleWindowHours }} h antes).</p>

        <div v-if="showCancelForm" class="booking-detail-cancel-block">
          <f7-list-input
            label="Motivo de cancelación"
            type="textarea"
            placeholder="Escribí el motivo (mín. 3 caracteres)"
            v-model:value="cancelReason"
            :disabled="saving"
          />
          <div class="booking-detail-cancel-actions">
            <f7-button fill small :disabled="saving || cancelReason.trim().length < 3" @click="confirmCancel">Confirmar cancelación</f7-button>
            <f7-button class="margin-top" small :disabled="saving" @click="hideCancelForm">Volver</f7-button>
          </div>
        </div>
      </f7-block>

      <!-- Modal reprogramar -->
      <f7-popup class="booking-reschedule-popup" :opened="showRescheduleModal" @popup:closed="showRescheduleModal = false">
        <f7-page>
          <f7-navbar title="Reprogramar" :back-link="'Cerrar'" @back-click="showRescheduleModal = false" />
          <f7-block strong inset>
            <f7-list-item title="Nueva fecha">
              <template #after>
                <input type="date" :value="rescheduleDate" :min="todayStr" @input="onRescheduleDateInput" />
              </template>
            </f7-list-item>
            <f7-list-item v-if="rescheduleDate && booking" title="Nuevo horario" group-title />
            <f7-block v-if="rescheduleSlotsLoading && rescheduleDate" class="slot-loading"><p>Cargando...</p></f7-block>
            <f7-block v-else-if="rescheduleSlots.length > 0" class="slot-buttons">
              <f7-button
                v-for="slot in rescheduleSlots"
                :key="slot.start"
                :fill="rescheduleStart === slot.start"
                small
                @click="rescheduleStart = slot.start; rescheduleEnd = slot.end"
              >
                {{ slot.start }} – {{ slot.end }}
              </f7-button>
            </f7-block>
            <f7-block v-else-if="rescheduleDate && !rescheduleSlotsLoading"><p class="text-color-gray">Sin horarios disponibles.</p></f7-block>
            <p v-if="rescheduleError" class="booking-detail-error">{{ rescheduleError }}</p>
            <f7-button fill large class="margin-top" :disabled="!rescheduleDate || !rescheduleStart || saving" @click="confirmReschedule">Guardar reprogramación</f7-button>
          </f7-block>
        </f7-page>
      </f7-popup>
    </template>

    <f7-block v-else-if="!loading" strong inset>
      <p>No se encontró el turno.</p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { doc, getDoc, updateDoc, serverTimestamp, runTransaction, arrayUnion, Timestamp, type UpdateData } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';
import { getCurrentUser } from '../../../auth/session';
import { f7ready } from 'framework7-vue';
import { getTenantBookingSettings, canCancelByWindow, canRescheduleByWindow } from '../../../services/tenantBookingSettings';
import { getAvailableSlots } from '../../../services/publicBookingApi';

interface ServiceSnap {
  name?: string;
  durationMinutes?: number;
  price?: number;
}
interface CustomerSnap {
  dni?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}
interface StatusHistoryEntry {
  at: unknown;
  from: string;
  to: string;
  by?: { type: string; id?: string | null };
  note?: string;
}
interface BookingDoc {
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  staffName?: string;
  customer?: CustomerSnap;
  clientSnapshot?: CustomerSnap;
  servicesSnapshot?: ServiceSnap[];
  totalDurationMinutes?: number;
  totalPrice?: number;
  notes?: string;
  cancelReason?: string;
  canceledAt?: unknown;
  canceledBy?: { type: string; id?: string | null } | null;
  rescheduledAt?: unknown;
  statusHistory?: StatusHistoryEntry[];
  startAt?: { toDate?: () => Date };
  createdAt?: { toDate?: () => Date };
  updatedAt?: { toDate?: () => Date };
  staffId?: string;
}

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const bookingId = computed(() => (route.params.bookingId as string) ?? '');
const agendaUrl = computed(() => `/t/${tenantId.value}/?tab=agenda`);

const booking = ref<BookingDoc | null>(null);
const loading = ref(true);
const errorMessage = ref('');
const saving = ref(false);
const showCancelForm = ref(false);
const cancelReason = ref('');
const bookingSettings = ref({ staffCancelWindowHours: 2, staffRescheduleWindowHours: 2 });
const showRescheduleModal = ref(false);
const rescheduleDate = ref('');
const rescheduleStart = ref('');
const rescheduleEnd = ref('');
const rescheduleSlots = ref<Array<{ start: string; end: string }>>([]);
const rescheduleSlotsLoading = ref(false);
const rescheduleError = ref('');

const todayStr = computed(() => {
  const t = new Date();
  return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
});

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    confirmed: 'Confirmado',
    pending: 'Pendiente',
    cancelled: 'Cancelado',
    completed: 'Completado',
    no_show: 'No asistió',
  };
  return (map[s] ?? s) || '—';
}

const statusBadgeClass = computed(() => {
  const s = booking.value?.status ?? '';
  if (s === 'confirmed' || s === 'completed') return 'badge color-green';
  if (s === 'cancelled' || s === 'no_show') return 'badge color-red';
  return 'badge color-orange';
});

const canChangeStatus = computed(() => {
  const s = booking.value?.status ?? '';
  return s === 'confirmed' || s === 'pending';
});

const isPending = computed(() => (booking.value?.status ?? '') === 'pending');

const bookingCustomer = computed((): CustomerSnap | undefined => {
  const b = booking.value;
  return b?.customer ?? b?.clientSnapshot;
});

const bookingStartAt = computed((): Date | null => {
  const b = booking.value;
  const raw = b?.startAt;
  if (!raw) return null;
  try {
    const toDate = (raw as { toDate?: () => Date }).toDate;
    if (typeof toDate === 'function') return toDate.call(raw);
    const sec = (raw as { seconds?: number }).seconds;
    if (typeof sec === 'number') return new Date(sec * 1000);
  } catch {
    return null;
  }
  return null;
});

const canCancelByDeadline = computed(() => {
  const start = bookingStartAt.value;
  if (!start || !canChangeStatus.value) return false;
  return canCancelByWindow(start, bookingSettings.value.staffCancelWindowHours);
});

const canRescheduleByDeadline = computed(() => {
  const start = bookingStartAt.value;
  if (!start || !canChangeStatus.value) return false;
  return canRescheduleByWindow(start, bookingSettings.value.staffRescheduleWindowHours);
});

function customerLabel(c?: CustomerSnap): string {
  if (!c) return '—';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sin nombre';
}

function formatPrice(v?: number): string {
  if (v == null) return '—';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(v);
}

function formatTimestamp(t: BookingDoc['createdAt']): string {
  if (!t || typeof (t as { toDate?: () => Date }).toDate !== 'function') return '—';
  const d = (t as { toDate: () => Date }).toDate();
  return d.toLocaleString('es-AR');
}

function pushStatusHistory(from: string, to: string, note?: string): Record<string, unknown> {
  const user = getCurrentUser();
  return {
    statusHistory: arrayUnion({
      at: Timestamp.now(),
      from,
      to,
      by: { type: 'admin', id: user?.uid ?? null },
      ...(note ? { note } : {}),
    }),
  };
}

async function updateBookingStatus(patch: UpdateData<BookingDoc> & { statusHistory?: unknown }): Promise<void> {
  const tid = tenantId.value;
  const bid = bookingId.value;
  if (!tid || !bid) return;
  const db = getDbInstance();
  const ref = doc(db, 'tenants', tid, 'bookings', bid);
  const payload: UpdateData<BookingDoc> & Record<string, unknown> = {
    ...patch,
    updatedAt: serverTimestamp(),
  };
  const user = getCurrentUser();
  if (user?.uid) payload.updatedByUid = user.uid;
  await updateDoc(ref, payload);
}

function hideCancelForm(): void {
  showCancelForm.value = false;
  cancelReason.value = '';
}

function showToast(text: string): void {
  f7ready((f7) => {
    f7.toast?.show?.({ text, closeTimeout: 2500 });
  });
}

function setError(msg: string): void {
  errorMessage.value = msg;
}

async function setConfirmed(): Promise<void> {
  if (saving.value || !booking.value) return;
  const prev = booking.value.status || 'pending';
  saving.value = true;
  errorMessage.value = '';
  try {
    await updateBookingStatus({
      status: 'confirmed',
      ...pushStatusHistory(prev, 'confirmed'),
    });
    booking.value = { ...booking.value, status: 'confirmed' };
    showToast('Turno confirmado');
  } catch (e) {
    console.error(e);
    setError('No se pudo actualizar. Intentá de nuevo.');
  } finally {
    saving.value = false;
  }
}

async function setCompleted(): Promise<void> {
  if (saving.value || !booking.value) return;
  const prev = booking.value.status || 'confirmed';
  saving.value = true;
  errorMessage.value = '';
  try {
    await updateBookingStatus({
      status: 'completed',
      ...pushStatusHistory(prev, 'completed'),
    });
    booking.value = { ...booking.value, status: 'completed' };
    showToast('Marcado como completado');
  } catch (e) {
    console.error(e);
    setError('No se pudo actualizar. Intentá de nuevo.');
  } finally {
    saving.value = false;
  }
}

async function setNoShow(): Promise<void> {
  if (saving.value || !booking.value) return;
  const prev = booking.value.status || 'confirmed';
  saving.value = true;
  errorMessage.value = '';
  try {
    await updateBookingStatus({
      status: 'no_show',
      ...pushStatusHistory(prev, 'no_show'),
    });
    booking.value = { ...booking.value, status: 'no_show' };
    showToast('Marcado como no asistió');
  } catch (e) {
    console.error(e);
    setError('No se pudo actualizar. Intentá de nuevo.');
  } finally {
    saving.value = false;
  }
}

async function confirmCancel(): Promise<void> {
  const reason = cancelReason.value.trim();
  if (reason.length < 3 || saving.value || !booking.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    const tid = tenantId.value;
    const bid = bookingId.value;
    const db = getDbInstance();
    const date = booking.value.date;
    const staffId = booking.value.staffId ?? '';
    const startTime = booking.value.startTime ?? '';
    const endTime = booking.value.endTime ?? '';
    const lockId = `${staffId}_${date}`;
    const slotStateRef = doc(db, 'tenants', tid, 'slotState', lockId);

    const prevStatus = booking.value.status || 'confirmed';
    const user = getCurrentUser();
    const historyEntry = {
      at: Timestamp.now(),
      from: prevStatus,
      to: 'cancelled',
      by: { type: 'admin' as const, id: user?.uid ?? null },
      note: reason,
    };

    await runTransaction(db, async (tx) => {
      const slotStateSnap = await tx.get(slotStateRef);
      const slots: Array<{ startTime: string; endTime: string }> = slotStateSnap.exists()
        ? (slotStateSnap.data().slots ?? [])
        : [];
      const newSlots = slots.filter(
        (s) => !(s.startTime === startTime && s.endTime === endTime)
      );
      if (slotStateSnap.exists()) {
        tx.update(slotStateRef, { slots: newSlots, updatedAt: serverTimestamp() });
      }
      const bookingRef = doc(db, 'tenants', tid, 'bookings', bid);
      const patch: UpdateData<BookingDoc> & Record<string, unknown> = {
        status: 'cancelled',
        cancelReason: reason,
        canceledAt: serverTimestamp(),
        canceledBy: { type: 'admin', id: user?.uid ?? null },
        statusHistory: arrayUnion(historyEntry),
        updatedAt: serverTimestamp(),
      };
      if (user?.uid) patch.updatedByUid = user.uid;
      tx.update(bookingRef, patch);
    });

    booking.value = {
      ...booking.value,
      status: 'cancelled',
      cancelReason: reason,
    };
    showCancelForm.value = false;
    cancelReason.value = '';
    showToast('Turno cancelado');
  } catch (e) {
    console.error(e);
    setError('No se pudo cancelar. Intentá de nuevo.');
  } finally {
    saving.value = false;
  }
}

async function loadBooking(): Promise<void> {
  const tid = tenantId.value;
  const bid = bookingId.value;
  if (!tid || !bid) {
    booking.value = null;
    loading.value = false;
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  const db = getDbInstance();
  try {
    const snap = await getDoc(doc(db, 'tenants', tid, 'bookings', bid));
    if (snap.exists()) {
      booking.value = snap.data() as BookingDoc;
    } else {
      booking.value = null;
    }
    try {
      const settings = await getTenantBookingSettings(tid);
      bookingSettings.value = settings;
    } catch {
      // Usar valores por defecto si no hay doc settings o hay error de permisos
    }
  } catch (err) {
    console.error('Error loading booking:', err);
    booking.value = null;
    setError('Error al cargar el turno.');
  } finally {
    loading.value = false;
  }
}

function onRescheduleDateInput(e: Event): void {
  rescheduleDate.value = (e.target as HTMLInputElement).value ?? '';
  rescheduleStart.value = '';
  rescheduleEnd.value = '';
  rescheduleSlots.value = [];
}

watch(
  () => [rescheduleDate.value, booking.value?.staffId, booking.value?.totalDurationMinutes] as const,
  async ([date, staffId, duration]) => {
    const tid = tenantId.value;
    if (!tid || !date || !staffId || !duration) {
      rescheduleSlots.value = [];
      return;
    }
    rescheduleSlotsLoading.value = true;
    rescheduleError.value = '';
    try {
      const slots = await getAvailableSlots(tid, staffId, date, duration);
      rescheduleSlots.value = slots;
    } catch (e) {
      rescheduleSlots.value = [];
    } finally {
      rescheduleSlotsLoading.value = false;
    }
  }
);

async function confirmReschedule(): Promise<void> {
  const b = booking.value;
  const tid = tenantId.value;
  const bid = bookingId.value;
  if (!b || !tid || !bid || !rescheduleDate.value || !rescheduleStart.value || !rescheduleEnd.value || saving.value) return;
  saving.value = true;
  rescheduleError.value = '';
  try {
    const db = getDbInstance();
    const staffId = b.staffId ?? '';
    const oldDate = b.date;
    const oldStart = b.startTime ?? '';
    const oldEnd = b.endTime ?? '';
    const newDate = rescheduleDate.value;
    const newStart = rescheduleStart.value;
    const newEnd = rescheduleEnd.value;
    const oldLockId = `${staffId}_${oldDate}`;
    const newLockId = `${staffId}_${newDate}`;
    const oldSlotStateRef = doc(db, 'tenants', tid, 'slotState', oldLockId);
    const newSlotStateRef = doc(db, 'tenants', tid, 'slotState', newLockId);
    const bookingRef = doc(db, 'tenants', tid, 'bookings', bid);
    const user = getCurrentUser();
    const prevStatus = b.status || 'confirmed';
    const historyEntry = {
      at: Timestamp.now(),
      from: prevStatus,
      to: 'confirmed',
      by: { type: 'admin' as const, id: user?.uid ?? null },
      note: 'rescheduled',
    };
    const newStartAt = new Date(`${newDate}T${newStart}:00`);
    const newEndAt = new Date(`${newDate}T${newEnd}:00`);

    await runTransaction(db, async (tx) => {
      const oldSnap = await tx.get(oldSlotStateRef);
      const oldSlots: Array<{ startTime: string; endTime: string }> = oldSnap.exists() ? (oldSnap.data().slots ?? []) : [];
      const withoutOld = oldSlots.filter((s) => !(s.startTime === oldStart && s.endTime === oldEnd));
      if (oldSnap.exists()) {
        tx.update(oldSlotStateRef, { slots: withoutOld, updatedAt: serverTimestamp() });
      }
      const newSnap = await tx.get(newSlotStateRef);
      const newSlots: Array<{ startTime: string; endTime: string }> = newSnap.exists() ? (newSnap.data().slots ?? []) : [];
      const overlap = newSlots.some((s) => s.startTime === newStart && s.endTime === newEnd);
      if (overlap) throw new Error('SLOT_TAKEN');
      newSlots.push({ startTime: newStart, endTime: newEnd });
      if (newSnap.exists()) tx.update(newSlotStateRef, { slots: newSlots, updatedAt: serverTimestamp() });
      else tx.set(newSlotStateRef, { staffId, date: newDate, slots: newSlots, updatedAt: serverTimestamp() });
      const patch: UpdateData<BookingDoc> & Record<string, unknown> = {
        date: newDate,
        startTime: newStart,
        endTime: newEnd,
        startAt: Timestamp.fromDate(newStartAt),
        endAt: Timestamp.fromDate(newEndAt),
        rescheduledAt: serverTimestamp(),
        statusHistory: arrayUnion(historyEntry),
        updatedAt: serverTimestamp(),
      };
      if (user?.uid) patch.updatedByUid = user.uid;
      tx.update(bookingRef, patch);
    });

    booking.value = {
      ...b,
      date: newDate,
      startTime: newStart,
      endTime: newEnd,
      startAt: { toDate: () => newStartAt },
    };
    showRescheduleModal.value = false;
    rescheduleDate.value = '';
    rescheduleStart.value = '';
    rescheduleEnd.value = '';
    rescheduleSlots.value = [];
    showToast('Turno reprogramado');
  } catch (e: unknown) {
    const err = e as Error;
    if (err?.message === 'SLOT_TAKEN') rescheduleError.value = 'Ese horario ya no está disponible.';
    else rescheduleError.value = err?.message ?? 'No se pudo reprogramar.';
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  loadBooking();
});
watch([tenantId, bookingId], () => {
  loadBooking();
});

watch(showRescheduleModal, (open) => {
  if (open && booking.value) {
    rescheduleDate.value = booking.value.date;
    rescheduleStart.value = '';
    rescheduleEnd.value = '';
    rescheduleError.value = '';
  }
});
</script>

<style scoped>
.booking-detail-error-block {
  margin-bottom: 0;
}
.booking-detail-error {
  margin: 0;
  color: var(--f7-color-red);
  font-size: 0.95rem;
}
.booking-detail-date {
  font-size: 1rem;
  margin: 0 0 0.25rem 0;
}
.booking-detail-time {
  font-weight: 600;
  font-size: 1.1rem;
  margin: 0 0 0.5rem 0;
}
.booking-detail-services {
  margin: 0.25rem 0 0 0;
  padding-left: 1.25rem;
}
.booking-detail-notes {
  margin: 0.25rem 0 0 0;
  white-space: pre-wrap;
}
.booking-detail-meta {
  font-size: 0.85rem;
  color: var(--f7-block-title-color, #6d6d72);
}
.booking-detail-meta p {
  margin: 0.25rem 0;
}
.margin-top {
  margin-top: 0.5rem;
}
.booking-detail-cancel-block {
  margin-top: 1rem;
}
.booking-detail-cancel-actions {
  margin-top: 0.75rem;
}
.booking-detail-cancel-actions .button {
  margin-right: 0.5rem;
}
.booking-detail-window-msg {
  margin: 0.5rem 0 0 0;
  font-size: 0.85rem;
  color: var(--f7-block-title-color, #6d6d72);
}
.slot-loading {
  margin-top: 0.5rem;
}
.slot-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.slot-buttons .button {
  margin: 0;
}
</style>

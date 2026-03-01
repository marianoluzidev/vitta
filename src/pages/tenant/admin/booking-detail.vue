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
        <f7-list-item title="Cliente" :after="customerLabel(booking.customer)" />
        <f7-list-item v-if="booking.customer?.dni" title="DNI" :after="booking.customer.dni" />
        <f7-list-item v-if="booking.customer?.phone" title="Teléfono" :after="booking.customer.phone" />
        <f7-list-item v-if="booking.customer?.email" title="Email" :after="booking.customer.email" />
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
        <f7-button fill small :disabled="saving" @click="setCompleted">Marcar como completado</f7-button>
        <f7-button class="margin-top" fill small :disabled="saving" @click="setNoShow">Marcar no show</f7-button>
        <f7-button v-if="!showCancelForm" class="margin-top" fill small :disabled="saving" @click="showCancelForm = true">Cancelar turno</f7-button>

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
    </template>

    <f7-block v-else-if="!loading" strong inset>
      <p>No se encontró el turno.</p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { doc, getDoc, updateDoc, serverTimestamp, runTransaction, type UpdateData } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';
import { getCurrentUser } from '../../../auth/session';
import { f7ready } from 'framework7-vue';

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
interface BookingDoc {
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  staffName?: string;
  customer?: CustomerSnap;
  servicesSnapshot?: ServiceSnap[];
  totalDurationMinutes?: number;
  totalPrice?: number;
  notes?: string;
  cancelReason?: string;
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
  return (s !== 'cancelled') && (s !== 'completed') && (s !== 'no_show');
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

async function updateBookingStatus(patch: UpdateData<BookingDoc>): Promise<void> {
  const tid = tenantId.value;
  const bid = bookingId.value;
  if (!tid || !bid) return;
  const db = getDbInstance();
  const ref = doc(db, 'tenants', tid, 'bookings', bid);
  const payload: UpdateData<BookingDoc> = {
    ...patch,
    updatedAt: serverTimestamp(),
  };
  const user = getCurrentUser();
  if (user?.uid) (payload as Record<string, unknown>).updatedByUid = user.uid;
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

async function setCompleted(): Promise<void> {
  if (saving.value || !booking.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    await updateBookingStatus({ status: 'completed' });
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
  saving.value = true;
  errorMessage.value = '';
  try {
    await updateBookingStatus({ status: 'no_show' });
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
      const user = getCurrentUser();
      const patch: UpdateData<BookingDoc> = {
        status: 'cancelled',
        cancelReason: reason,
        updatedAt: serverTimestamp(),
      };
      if (user?.uid) (patch as Record<string, unknown>).updatedByUid = user.uid;
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

function loadBooking(): void {
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
  getDoc(doc(db, 'tenants', tid, 'bookings', bid))
    .then((snap) => {
      if (snap.exists()) {
        booking.value = snap.data() as BookingDoc;
      } else {
        booking.value = null;
      }
    })
    .catch((err) => {
      console.error('Error loading booking:', err);
      booking.value = null;
      setError('Error al cargar el turno.');
    })
    .finally(() => {
      loading.value = false;
    });
}

onMounted(loadBooking);
watch([tenantId, bookingId], loadBooking);
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
</style>

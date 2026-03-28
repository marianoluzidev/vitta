<template>
  <f7-page class="admin-page">
    <f7-navbar title="Pendientes" />

    <f7-block strong inset>
      <p class="block-title">Turnos pendientes</p>
      <p class="pending-hint">Solo se muestran turnos confirmados o pendientes que aún no pasaron (sin cancelados ni no show).</p>
    </f7-block>
    <f7-block v-if="loading" class="block-strong">
      <p>Cargando...</p>
    </f7-block>
    <f7-list v-else-if="pendingBookings.length > 0" strong inset>
      <f7-list-item
        v-for="b in pendingBookings"
        :key="b.id"
        class="pending-booking-item"
        link
        :href="bookingDetailUrl(b.id)"
        @click.prevent="goToBookingDetail(b.id)"
      >
        <template #default>
          <div class="pending-booking">
            <div class="pending-booking-header">
              <span class="pending-booking-date">{{ b.date }}</span>
              <span class="pending-booking-time">{{ b.startTime }} – {{ b.endTime }}</span>
              <span :class="['badge', statusBadgeClass(b.status)]">{{ statusLabel(b.status) }}</span>
            </div>
            <div class="pending-booking-row">
              <span class="pending-booking-label">Staff:</span>
              <span>{{ b.staffName || '—' }}</span>
            </div>
            <div class="pending-booking-row">
              <span class="pending-booking-label">Cliente:</span>
              <span>{{ customerLabel(b.customer) || '—' }}</span>
            </div>
          </div>
        </template>
      </f7-list-item>
    </f7-list>
    <f7-block v-else class="block-strong">
      <p>No hay turnos pendientes.</p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';

interface CustomerSnap {
  firstName?: string;
  lastName?: string;
}
interface PendingBookingItem {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  staffName: string;
  status: string;
  customer?: CustomerSnap;
}

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');

const todayStr = computed(() => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
});

/** Hora actual en "HH:mm" para filtrar turnos de hoy que ya pasaron */
function currentTimeHHMM(): string {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

/** Solo pendientes o confirmados; excluye cancelados, no_show, completados y turnos ya pasados */
function isPendingBooking(doc: { data: () => { date?: string; startTime?: string; status?: string } }): boolean {
  const d = doc.data();
  const status = d.status ?? '';
  if (status === 'cancelled' || status === 'no_show' || status === 'completed') return false;
  if (status !== 'pending' && status !== 'confirmed') return false;
  const date = d.date ?? '';
  if (date < todayStr.value) return false;
  if (date > todayStr.value) return true;
  const start = d.startTime ?? '00:00';
  return start >= currentTimeHHMM();
}

const pendingBookings = ref<PendingBookingItem[]>([]);
const loading = ref(false);

function customerLabel(c?: CustomerSnap): string {
  if (!c) return '';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sin nombre';
}
function statusLabel(s: string): string {
  const map: Record<string, string> = { confirmed: 'Confirmado', pending: 'Pendiente', cancelled: 'Cancelado', completed: 'Completado', no_show: 'No asistió' };
  return map[s ?? ''] ?? (s || '—');
}
function statusBadgeClass(s: string): string {
  if (s === 'confirmed' || s === 'completed') return 'color-green';
  if (s === 'cancelled' || s === 'no_show') return 'color-red';
  return 'color-orange';
}

function bookingDetailUrl(bookingId: string): string {
  return `/t/${tenantId.value}/admin/agenda/booking/${bookingId}/`;
}

function goToBookingDetail(bookingId: string): void {
  router.push(bookingDetailUrl(bookingId));
}

function loadPendingBookings() {
  const tid = tenantId.value;
  if (!tid) return;
  loading.value = true;
  const db = getDbInstance();
  const q = query(
    collection(db, 'tenants', tid, 'bookings'),
    where('date', '>=', todayStr.value),
    orderBy('date', 'asc'),
    orderBy('startTime', 'asc')
  );
  getDocs(q)
    .then((snap) => {
      pendingBookings.value = snap.docs
        .filter((doc) => isPendingBooking(doc))
        .map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            date: d.date ?? '',
            startTime: d.startTime ?? '',
            endTime: d.endTime ?? '',
            staffName: d.staffName ?? '',
            status: d.status ?? '',
            customer: d.customer ?? d.clientSnapshot,
          };
        });
    })
    .catch((err) => {
      console.error('Error loading pending bookings:', err);
      pendingBookings.value = [];
    })
    .finally(() => {
      loading.value = false;
    });
}

onMounted(() => loadPendingBookings());
</script>

<style scoped>
.pending-hint {
  font-size: 0.875rem;
  opacity: 0.85;
  margin: 0.25rem 0 0 0;
}
.pending-booking-item {
  align-items: flex-start;
}
.pending-booking {
  width: 100%;
  padding: 0.25rem 0;
}
.pending-booking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}
.pending-booking-date {
  font-weight: 600;
  font-size: 0.95rem;
}
.pending-booking-time {
  font-weight: 600;
  font-size: 1rem;
}
.pending-booking-row {
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
  color: var(--f7-block-title-color, #6d6d72);
}
.pending-booking-label {
  font-weight: 500;
  display: inline-block;
  min-width: 4.5rem;
}
</style>

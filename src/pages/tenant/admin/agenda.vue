<template>
  <f7-page class="admin-page">
    <f7-navbar title="Agenda">
      <f7-nav-right>
        <f7-link @click="goToNewBooking">+ Turno</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <f7-block strong inset class="agenda-calendar-block">
      <div class="agenda-calendar-header">
        <f7-link class="agenda-calendar-nav" @click="prevMonth">&lsaquo;</f7-link>
        <span class="agenda-calendar-title">{{ calendarMonthTitle }}</span>
        <f7-link class="agenda-calendar-nav" @click="nextMonth">&rsaquo;</f7-link>
      </div>
      <div class="agenda-calendar-weekdays">
        <span v-for="w in weekdays" :key="w" class="agenda-calendar-wday">{{ w }}</span>
      </div>
      <div class="agenda-calendar-grid">
        <template v-for="(cell, i) in calendarDays" :key="i">
          <span
            v-if="cell === null"
            class="agenda-calendar-day agenda-calendar-day--empty"
          />
          <button
            v-else
            type="button"
            :class="[
              'agenda-calendar-day',
              'agenda-calendar-day--clickable',
              { 'agenda-calendar-day--selected': cell.date === selectedDate },
              { 'agenda-calendar-day--has-bookings': datesWithBookings.has(cell.date) },
              { 'agenda-calendar-day--today': cell.date === todayStr }
            ]"
            @click="selectDate(cell.date)"
          >
            {{ cell.day }}
          </button>
        </template>
      </div>
    </f7-block>

    <f7-block v-if="loading" class="block-strong">
      <p>Cargando...</p>
    </f7-block>

    <f7-list v-else-if="bookings.length > 0" strong inset>
      <f7-list-item
        v-for="b in bookings"
        :key="b.id"
        class="agenda-booking-item"
        link
        :href="bookingDetailUrl(b.id)"
        @click.prevent="goToBookingDetail(b.id)"
      >
        <template #default>
          <div class="agenda-booking">
            <div class="agenda-booking-header">
              <span class="agenda-booking-time">{{ b.startTime }} – {{ b.endTime }}</span>
              <span v-if="b.status !== 'confirmed'" class="badge color-orange">{{ b.status }}</span>
            </div>
            <div class="agenda-booking-row">
              <span class="agenda-booking-label">Staff:</span>
              <span>{{ b.staffName || '—' }}</span>
            </div>
            <div class="agenda-booking-row">
              <span class="agenda-booking-label">Cliente:</span>
              <span>{{ customerLabel(b.customer) || '—' }}</span>
            </div>
            <div v-if="customerPhone(b.customer)" class="agenda-booking-row">
              <span class="agenda-booking-label">Tel:</span>
              <span>{{ customerPhone(b.customer) }}</span>
            </div>
            <div v-if="servicesLabel(b.servicesSnapshot)" class="agenda-booking-row">
              <span class="agenda-booking-label">Servicios:</span>
              <span>{{ servicesLabel(b.servicesSnapshot) }}</span>
            </div>
            <div class="agenda-booking-row">
              <span class="agenda-booking-label">Duración:</span>
              <span>{{ b.totalDurationMinutes }} min</span>
            </div>
          </div>
        </template>
      </f7-list-item>
    </f7-list>

    <f7-block v-else class="block-strong">
      <p>No hay turnos para esta fecha.</p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const weekdays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

interface ServiceSnap {
  name?: string;
}
interface CustomerSnap {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}
interface BookingItem {
  id: string;
  startTime: string;
  endTime: string;
  staffName: string;
  totalDurationMinutes: number;
  totalPrice?: number;
  status: string;
  customer?: CustomerSnap;
  servicesSnapshot?: ServiceSnap[];
}

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');

const today = new Date();
function toYMD(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const todayStr = computed(() => toYMD(today));

const selectedDate = ref(toYMD(today));
const calendarYear = ref(today.getFullYear());
const calendarMonth = ref(today.getMonth());
const datesWithBookings = ref<Set<string>>(new Set());
const bookings = ref<BookingItem[]>([]);
const loading = ref(false);

const calendarMonthTitle = computed(() => `${MONTH_NAMES[calendarMonth.value]} ${calendarYear.value}`);

const calendarDays = computed(() => {
  const y = calendarYear.value;
  const m = calendarMonth.value;
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const startWeekday = first.getDay();
  const daysInMonth = last.getDate();
  const cells: (null | { date: string; day: number })[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    cells.push({ date, day: d });
  }
  const remainder = cells.length % 7;
  if (remainder) for (let i = 0; i < 7 - remainder; i++) cells.push(null);
  return cells;
});

function prevMonth(): void {
  if (calendarMonth.value === 0) {
    calendarMonth.value = 11;
    calendarYear.value -= 1;
  } else {
    calendarMonth.value -= 1;
  }
}

function nextMonth(): void {
  if (calendarMonth.value === 11) {
    calendarMonth.value = 0;
    calendarYear.value += 1;
  } else {
    calendarMonth.value += 1;
  }
}

function selectDate(date: string): void {
  selectedDate.value = date;
}

function customerLabel(c?: CustomerSnap): string {
  if (!c) return '';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sin nombre';
}
function customerPhone(c?: CustomerSnap): string {
  return c?.phone?.trim() ?? '';
}
function servicesLabel(services?: ServiceSnap[]): string {
  if (!services?.length) return '';
  return services.map((s) => s.name || '').filter(Boolean).join(', ');
}

function goToNewBooking(): void {
  router.push(`/t/${tenantId.value}/admin/agenda/new/`);
}

function bookingDetailUrl(bookingId: string): string {
  return `/t/${tenantId.value}/admin/agenda/booking/${bookingId}/`;
}

function goToBookingDetail(bookingId: string): void {
  router.push(bookingDetailUrl(bookingId));
}

function loadBookings(): void {
  const tid = tenantId.value;
  const date = selectedDate.value;
  if (!tid || !date) {
    bookings.value = [];
    return;
  }
  loading.value = true;
  const db = getDbInstance();
  const q = query(
    collection(db, 'tenants', tid, 'bookings'),
    where('date', '==', date),
    orderBy('startTime', 'asc')
  );
  getDocs(q)
    .then((snap) => {
      bookings.value = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          startTime: d.startTime ?? '',
          endTime: d.endTime ?? '',
          staffName: d.staffName ?? '',
          totalDurationMinutes: d.totalDurationMinutes ?? 0,
          totalPrice: d.totalPrice,
          status: d.status ?? '',
          customer: d.customer,
          servicesSnapshot: d.servicesSnapshot ?? [],
        };
      });
    })
    .catch((err) => {
      console.error('Error loading bookings:', err);
      bookings.value = [];
    })
    .finally(() => {
      loading.value = false;
    });
}

function loadDatesWithBookings(): void {
  const tid = tenantId.value;
  if (!tid) return;
  const y = calendarYear.value;
  const m = calendarMonth.value;
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const db = getDbInstance();
  const q = query(
    collection(db, 'tenants', tid, 'bookings'),
    where('date', '>=', start),
    where('date', '<=', end)
  );
  getDocs(q)
    .then((snap) => {
      const set = new Set<string>();
      snap.docs.forEach((doc) => {
        const date = doc.data().date;
        if (date) set.add(date);
      });
      datesWithBookings.value = set;
    })
    .catch(() => {
      datesWithBookings.value = new Set();
    });
}

watch(
  () => [tenantId.value, selectedDate.value] as const,
  () => loadBookings(),
  { immediate: true }
);

watch(
  () => [tenantId.value, calendarYear.value, calendarMonth.value] as const,
  () => loadDatesWithBookings(),
  { immediate: true }
);
</script>

<style scoped>
.agenda-calendar-block {
  padding: 1rem;
}
.agenda-calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.agenda-calendar-title {
  font-weight: 600;
  font-size: 1.1rem;
}
.agenda-calendar-nav {
  font-size: 1.5rem;
  padding: 0.25rem 0.5rem;
  min-width: 2.5rem;
  text-align: center;
}
.agenda-calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
  font-size: 0.75rem;
  color: var(--f7-block-title-color, #6d6d72);
  font-weight: 500;
}
.agenda-calendar-wday {
  text-align: center;
}
.agenda-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.agenda-calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  border-radius: 8px;
  border: none;
  background: transparent;
  padding: 0;
}
.agenda-calendar-day--empty {
  pointer-events: none;
}
.agenda-calendar-day--clickable {
  cursor: pointer;
  transition: background 0.15s;
}
.agenda-calendar-day--clickable:hover {
  background: rgba(0, 0, 0, 0.06);
}
.agenda-calendar-day--selected {
  background: var(--f7-theme-color, #007aff);
  color: #fff;
  font-weight: 600;
}
.agenda-calendar-day--has-bookings:not(.agenda-calendar-day--selected) {
  position: relative;
}
.agenda-calendar-day--has-bookings:not(.agenda-calendar-day--selected)::after {
  content: '';
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--f7-color-green, #34c759);
}
.agenda-calendar-day--today:not(.agenda-calendar-day--selected) {
  font-weight: 600;
  border: 2px solid var(--f7-theme-color, #007aff);
}

.agenda-booking-item {
  align-items: flex-start;
}
.agenda-booking {
  width: 100%;
  padding: 0.25rem 0;
}
.agenda-booking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.agenda-booking-time {
  font-weight: 600;
  font-size: 1rem;
}
.agenda-booking-row {
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
  color: var(--f7-block-title-color, #6d6d72);
}
.agenda-booking-row span:first-child {
  display: inline-block;
  min-width: 4.5rem;
}
.agenda-booking-label {
  font-weight: 500;
}
</style>

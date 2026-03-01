<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar title="Nuevo Turno" back-link="Atrás" :back-link-url="agendaListUrl">
      <f7-nav-right>
        <f7-link @click="handleSave" :disabled="saving || !canSave">Guardar</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <f7-block v-if="slotTakenError" strong inset class="booking-error-block">
      <p class="booking-error">Ese horario ya fue tomado. Elegí otro.</p>
    </f7-block>
    <f7-block strong inset>
      <f7-list form>
        <!-- A) Staff (sheet desde abajo con búsqueda) -->
        <f7-list-item title="Staff" group-title />
        <f7-list-item
          :title="form.staffId ? (selectedStaffDoc ? fullName(selectedStaffDoc) : 'Cargando...') : 'Elegir staff'"
          link
          @click="staffSheetOpen = true"
        >
          <template #after>
            <span class="picker-change">{{ form.staffId ? 'Cambiar' : 'Elegir' }}</span>
          </template>
        </f7-list-item>
        <StaffSheetPicker
          :opened="staffSheetOpen"
          :staff-list="activeStaffList"
          @select="onStaffSheetSelect"
          @close="staffSheetOpen = false"
        />

        <!-- B) Services (multi) -->
        <f7-list-item v-if="filteredServices.length > 0" title="Servicios" group-title />
        <f7-list-item
          v-for="svc in filteredServices"
          :key="svc.id"
          :title="svc.name"
          checkbox
          :checked="form.serviceIds.includes(svc.id)"
          @change="toggleService(svc.id)"
        >
          <template #after>
            {{ svc.durationMinutes }} min · {{ formatPrice(svc.price) }}
          </template>
        </f7-list-item>
        <f7-list-item v-if="selectedServicesTotal.duration > 0" title="Total">
          <template #after>
            {{ selectedServicesTotal.duration }} min · {{ formatPrice(selectedServicesTotal.price) }}
          </template>
        </f7-list-item>

        <!-- C) Date -->
        <f7-list-item title="Fecha">
          <template #after>
            <input type="date" :value="form.date" @input="onDateInput" />
          </template>
        </f7-list-item>

        <!-- D) Slots -->
        <f7-list-item v-if="availableSlots.length > 0" title="Horario" group-title />
        <f7-block v-if="availableSlots.length > 0" class="slot-buttons">
          <f7-button
            v-for="slot in availableSlots"
            :key="slot.start"
            :fill="form.startTime === slot.start"
            small
            @click="selectSlot(slot.start, slot.end)"
          >
            {{ slot.start }} – {{ slot.end }}
          </f7-button>
        </f7-block>
        <f7-list-item v-else-if="slotQueryReady && form.staffId && form.date && selectedServicesTotal.duration > 0" title="Horario">
          <template #after>
            <span class="text-color-gray">Sin horarios disponibles</span>
          </template>
        </f7-list-item>

        <!-- E) Cliente (sheet desde abajo con búsqueda) -->
        <f7-list-item title="Cliente" group-title />
        <f7-list-item
          :title="form.clientId ? clientSummary : 'Elegir cliente'"
          link
          @click="clientSheetOpen = true"
        >
          <template #after>
            <span class="picker-change">{{ form.clientId ? 'Cambiar' : 'Elegir' }}</span>
          </template>
        </f7-list-item>
        <ClientSheetPicker
          :opened="clientSheetOpen"
          :tenant-id="tenantId"
          @select="onClientSheetSelect"
          @close="clientSheetOpen = false"
        />
        <f7-list-input label="Notas" type="textarea" v-model:value="form.notes" clear-button placeholder="Opcional" />
      </f7-list>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  runTransaction,
  increment,
  arrayUnion,
} from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';
import StaffSheetPicker from '../../../components/StaffSheetPicker.vue';
import ClientSheetPicker from '../../../components/ClientSheetPicker.vue';

const TZ = 'America/Argentina/Buenos_Aires';
const SLOT_STEP = 15;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
type DayKey = (typeof DAY_KEYS)[number];

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** True if intervals overlap: newStart < existingEnd AND existingStart < newEnd */
function timeOverlaps(
  newStartMin: number,
  newEndMin: number,
  existingStartMin: number,
  existingEndMin: number
): boolean {
  return newStartMin < existingEndMin && existingStartMin < newEndMin;
}
function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
function getDayKeyFromDate(dateStr: string): DayKey {
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
  const out: Interval[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i].start <= last.end) {
      last.end = Math.max(last.end, sorted[i].end);
    } else {
      out.push(sorted[i]);
    }
  }
  return out;
}
function subtractIntervals(open: Interval[], busy: Interval[]): Interval[] {
  let result: Interval[] = [...open];
  for (const b of busy) {
    const next: Interval[] = [];
    for (const a of result) {
      if (b.end <= a.start || b.start >= a.end) {
        next.push(a);
      } else {
        if (a.start < b.start) next.push({ start: a.start, end: b.start });
        if (b.end < a.end) next.push({ start: b.end, end: a.end });
      }
    }
    result = next;
  }
  return mergeIntervals(result);
}

interface ScheduleBlock {
  start: string;
  end: string;
  breaks: Array<{ start: string; end: string }>;
}
function getOpenIntervalsForDay(blocks: ScheduleBlock[]): Interval[] {
  const open: Interval[] = [];
  for (const block of blocks) {
    const start = parseTime(block.start);
    const end = parseTime(block.end);
    const breakInts: Interval[] = (block.breaks || []).map((br) => ({
      start: parseTime(br.start),
      end: parseTime(br.end),
    }));
    const blockInterval = [{ start, end }];
    const free = subtractIntervals(blockInterval, breakInts);
    open.push(...free);
  }
  return mergeIntervals(open);
}

function getAvailableStartTimes(
  openIntervals: Interval[],
  busyIntervals: Interval[],
  durationMinutes: number,
  step: number
): Array<{ start: string; end: string }> {
  const free = subtractIntervals(openIntervals, busyIntervals);
  const slots: Array<{ start: string; end: string }> = [];
  for (const iv of free) {
    let t = iv.start;
    while (t + durationMinutes <= iv.end) {
      const end = t + durationMinutes;
      const overlap = busyIntervals.some((b) => !(end <= b.start || t >= b.end));
      if (!overlap) slots.push({ start: minutesToTime(t), end: minutesToTime(end) });
      t += step;
    }
  }
  return slots;
}

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => {
  const p = route.params.tenantId;
  return Array.isArray(p) ? (p[0] ?? '') : (p ?? '');
});
const agendaListUrl = computed(() => `/t/${tenantId.value}/?tab=agenda`);
const saving = ref(false);
const slotTakenError = ref(false);
const staffSheetOpen = ref(false);
const clientSheetOpen = ref(false);

const activeStaffList = ref<Array<{ id: string; firstName: string; lastName: string; active: boolean }>>([]);
const allServices = ref<Array<{ id: string; name: string; price: number; durationMinutes: number; active: boolean }>>([]);
interface StaffDoc {
  serviceIds: string[];
  schedule?: Record<string, ScheduleBlock[]>;
  firstName?: string;
  lastName?: string;
}
const selectedStaffDoc = ref<StaffDoc | null>(null);
const bookingsForDate = ref<Array<{ startTime: string; endTime: string; status: string }>>([]);

const form = reactive({
  staffId: '',
  serviceIds: [] as string[],
  date: '',
  startTime: '',
  endTime: '',
  clientId: '' as string,
  customer: {
    dni: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  },
  notes: '',
});

function onClientSelect(client: { id: string; dni?: string; firstName?: string; lastName?: string; phone?: string; email?: string } | null): void {
  if (!client) {
    form.clientId = '';
    form.customer = { dni: '', firstName: '', lastName: '', phone: '', email: '' };
    return;
  }
  form.clientId = client.id;
  form.customer = {
    dni: (client.dni ?? '').trim(),
    firstName: (client.firstName ?? '').trim(),
    lastName: (client.lastName ?? '').trim(),
    phone: (client.phone ?? '').trim(),
    email: (client.email ?? '').trim(),
  };
}

function fullName(s: { firstName?: string; lastName?: string }): string {
  return [(s.firstName ?? ''), (s.lastName ?? '')].filter(Boolean).join(' ') || 'Sin nombre';
}

const clientSummary = computed(() => {
  const c = form.customer;
  const parts = [(c.firstName ?? '').trim(), (c.lastName ?? '').trim()].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
});

function onStaffSheetSelect(staff: { id: string }): void {
  selectStaff(staff.id);
  staffSheetOpen.value = false;
}

function onClientSheetSelect(client: { id: string; dni?: string; firstName?: string; lastName?: string; phone?: string; email?: string }): void {
  onClientSelect(client);
  clientSheetOpen.value = false;
}
function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price);
}

const filteredServices = computed(() => {
  const ids = selectedStaffDoc.value?.serviceIds ?? [];
  if (ids.length === 0) return [];
  return allServices.value.filter((s) => s.active && ids.includes(s.id));
});

const selectedServicesTotal = computed(() => {
  let duration = 0;
  let price = 0;
  for (const id of form.serviceIds) {
    const s = allServices.value.find((x) => x.id === id);
    if (s) {
      duration += s.durationMinutes;
      price += s.price;
    }
  }
  return { duration, price };
});

const openIntervalsForSelectedDay = computed(() => {
  const staff = selectedStaffDoc.value;
  const dayKey = form.date ? getDayKeyFromDate(form.date) : null;
  if (!staff?.schedule || !dayKey) return [];
  const blocks = staff.schedule[dayKey] ?? [];
  return getOpenIntervalsForDay(blocks);
});

const busyIntervalsForDate = computed((): Interval[] => {
  return bookingsForDate.value
    .filter((b) => b.status !== 'cancelled')
    .map((b) => ({ start: parseTime(b.startTime), end: parseTime(b.endTime) }));
});

const availableSlots = computed(() => {
  const duration = selectedServicesTotal.value.duration;
  if (duration <= 0 || openIntervalsForSelectedDay.value.length === 0) return [];
  return getAvailableStartTimes(
    openIntervalsForSelectedDay.value,
    busyIntervalsForDate.value,
    duration,
    SLOT_STEP
  );
});

const slotQueryReady = ref(true);
watch(
  () => [form.staffId, form.date] as const,
  async ([sid, date]) => {
    const tid = tenantId.value;
    if (!tid || !sid || !date) {
      bookingsForDate.value = [];
      return;
    }
    slotQueryReady.value = false;
    try {
      const db = getDbInstance();
      const q = query(
        collection(db, 'tenants', tid, 'bookings'),
        where('staffId', '==', sid),
        where('date', '==', date)
      );
      const snap = await getDocs(q);
      bookingsForDate.value = snap.docs.map((d) => {
        const data = d.data();
        return {
          startTime: data.startTime ?? '',
          endTime: data.endTime ?? '',
          status: data.status ?? '',
        };
      });
    } catch (e) {
      console.error('Error fetching bookings:', e);
      bookingsForDate.value = [];
    } finally {
      slotQueryReady.value = true;
    }
  },
  { immediate: true }
);

const canSave = computed(() => {
  if (!form.staffId || !form.date || !form.startTime || !form.endTime) return false;
  if (selectedServicesTotal.value.duration <= 0) return false;
  if (!form.clientId) return false;
  const c = form.customer;
  if (!String(c.firstName).trim() && !String(c.lastName).trim()) return false;
  return true;
});

function toggleService(serviceId: string): void {
  const idx = form.serviceIds.indexOf(serviceId);
  if (idx === -1) form.serviceIds.push(serviceId);
  else form.serviceIds.splice(idx, 1);
}

function selectStaff(sid: string): void {
  form.staffId = sid;
  form.serviceIds = [];
  form.startTime = '';
  form.endTime = '';
  slotTakenError.value = false;
  selectedStaffDoc.value = null;
  if (!sid) return;
  const tid = tenantId.value;
  if (!tid) return;
  getDoc(doc(getDbInstance(), 'tenants', tid, 'staff', sid)).then((snap) => {
    if (snap.exists()) selectedStaffDoc.value = snap.data() as StaffDoc;
  });
}

function selectSlot(start: string, end: string): void {
  slotTakenError.value = false;
  form.startTime = start;
  form.endTime = end;
}

function onDateInput(e: Event): void {
  form.date = (e.target as HTMLInputElement).value ?? '';
  form.startTime = '';
  form.endTime = '';
  slotTakenError.value = false;
}

onMounted(async () => {
  const tid = tenantId.value;
  if (!tid) return;
  const db = getDbInstance();
  const today = new Date();
  form.date = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

  const [staffSnap, servicesSnap] = await Promise.all([
    getDocs(query(collection(db, 'tenants', tid, 'staff'), where('active', '==', true))),
    getDocs(collection(db, 'tenants', tid, 'services')),
  ]);
  activeStaffList.value = staffSnap.docs.map((d) => ({
    id: d.id,
    firstName: d.data().firstName ?? '',
    lastName: d.data().lastName ?? '',
    active: d.data().active ?? true,
  }));
  allServices.value = servicesSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name ?? '',
      price: data.price ?? 0,
      durationMinutes: data.durationMinutes ?? 0,
      active: data.active ?? true,
    };
  });
  if (form.staffId) {
    const sd = await getDoc(doc(db, 'tenants', tid, 'staff', form.staffId));
    if (sd.exists()) selectedStaffDoc.value = sd.data() as StaffDoc;
  }
});

async function handleSave(): Promise<void> {
  const tid = tenantId.value;
  if (!tid || !canSave.value || saving.value) return;
  const staff = selectedStaffDoc.value;
  const staffName = staff ? fullName({ firstName: staff.firstName ?? '', lastName: staff.lastName ?? '' }) : '';
  if (!staffName) return;

  saving.value = true;
  slotTakenError.value = false;
  try {
    const db = getDbInstance();
    const sid = form.staffId;
    const date = form.date;
    const startTime = form.startTime;
    const endTime = form.endTime;
    const newStartMin = parseTime(startTime);
    const newEndMin = parseTime(endTime);

    const servicesSnapshot = form.serviceIds
      .map((id) => allServices.value.find((s) => s.id === id))
      .filter(Boolean)
      .map((s) => ({
        id: s!.id,
        name: s!.name,
        price: s!.price,
        durationMinutes: s!.durationMinutes,
      }));

    const startAt = new Date(`${date}T${startTime}:00`);
    const endAt = new Date(`${date}T${endTime}:00`);
    const bookingData = {
      staffId: sid,
      staffName,
      serviceIds: [...form.serviceIds],
      servicesSnapshot,
      totalPrice: selectedServicesTotal.value.price,
      totalDurationMinutes: selectedServicesTotal.value.duration,
      date,
      startTime,
      endTime,
      startAt: Timestamp.fromDate(startAt),
      endAt: Timestamp.fromDate(endAt),
      status: 'confirmed',
      source: 'admin',
      clientId: form.clientId,
      customer: {
        dni: String(form.customer.dni).trim(),
        firstName: String(form.customer.firstName).trim(),
        lastName: String(form.customer.lastName).trim(),
        phone: String(form.customer.phone).trim(),
        email: String(form.customer.email).trim(),
      },
      notes: String(form.notes).trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await runTransaction(db, async (tx) => {
      const lockId = `${sid}_${date}`;
      const lockRef = doc(db, 'tenants', tid, 'locks', lockId);
      const slotStateRef = doc(db, 'tenants', tid, 'slotState', lockId);
      // slotState holds occupied slots for this staff+date; when cancelling a booking, remove its slot from slotState. If you have existing bookings, backfill slotState for those staff+date once.

      // All reads first (web SDK tx.get() only accepts DocumentReference, not Query)
      const lockSnap = await tx.get(lockRef);
      const slotStateSnap = await tx.get(slotStateRef);
      const slots: Array<{ startTime: string; endTime: string }> = slotStateSnap.exists()
        ? (slotStateSnap.data().slots ?? [])
        : [];

      for (const slot of slots) {
        const existingStart = parseTime(slot.startTime ?? '');
        const existingEnd = parseTime(slot.endTime ?? '');
        if (timeOverlaps(newStartMin, newEndMin, existingStart, existingEnd)) {
          const err = new Error('SLOT_TAKEN');
          (err as Error & { code?: string }).code = 'SLOT_TAKEN';
          throw err;
        }
      }

      // All writes after reads
      if (!lockSnap.exists()) {
        tx.set(lockRef, {
          staffId: sid,
          date,
          updatedAt: serverTimestamp(),
          version: 1,
        });
      } else {
        tx.update(lockRef, {
          updatedAt: serverTimestamp(),
          version: increment(1),
        });
      }
      const newSlot = { startTime, endTime };
      if (!slotStateSnap.exists()) {
        tx.set(slotStateRef, { staffId: sid, date, slots: [newSlot], updatedAt: serverTimestamp() });
      } else {
        tx.update(slotStateRef, {
          slots: arrayUnion(newSlot),
          updatedAt: serverTimestamp(),
        });
      }
      const newBookingRef = doc(collection(db, 'tenants', tid, 'bookings'));
      tx.set(newBookingRef, bookingData);
    });

    router.back();
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err?.code === 'SLOT_TAKEN' || err?.message === 'SLOT_TAKEN') {
      slotTakenError.value = true;
    } else {
      console.error('Error creating booking:', e);
    }
    saving.value = false;
  }
}
</script>

<style scoped>
.slot-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.slot-buttons .button {
  margin: 0;
}
.booking-error-block {
  margin-bottom: 0;
}
.booking-error {
  margin: 0;
  color: var(--f7-color-red);
  font-size: 0.95rem;
}
.picker-change {
  font-size: 0.9rem;
  color: var(--f7-theme-color, #007aff);
}
</style>

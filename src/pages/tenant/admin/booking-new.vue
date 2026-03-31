<template>
  <f7-page class="booking-new-page admin-page tenant-login">
    <f7-navbar title="Nuevo Turno" back-link="Atrás" :back-link-url="agendaListUrl">
      <f7-nav-right>
        <f7-link
          :class="{ 'disabled': saving || !canSave }"
          @click="onNavSave"
        >
          {{ saving ? 'Guardando...' : 'Guardar' }}
        </f7-link>
      </f7-nav-right>
    </f7-navbar>

    <div class="ds-page-content">
      <VCard v-if="slotTakenError" error>
        <p class="ds-error-text">Ese horario ya fue tomado. Elegí otro.</p>
      </VCard>

      <!-- Staff -->
      <VCard>
        <VSectionTitle>Staff</VSectionTitle>
        <VListItem clickable @click="staffSheetOpen = true">
          <template #default>
            <span v-if="form.staffId" class="ds-value">{{ selectedStaffDoc ? fullName(selectedStaffDoc) : 'Cargando...' }}</span>
            <span v-else class="ds-placeholder">Elegir staff</span>
          </template>
          <template #after>{{ form.staffId ? 'Cambiar' : 'Elegir' }}</template>
        </VListItem>
      </VCard>
      <StaffSheetPicker
        :opened="staffSheetOpen"
        :staff-list="activeStaffList"
        @select="onStaffSheetSelect"
        @close="staffSheetOpen = false"
      />

      <!-- Servicios -->
      <VCard v-if="filteredServices.length > 0">
        <VSectionTitle>Servicios</VSectionTitle>
        <div
          v-for="svc in filteredServices"
          :key="svc.id"
          class="booking-new-service-row"
        >
          <label class="booking-new-service-label">
            <input
              type="checkbox"
              :checked="form.serviceIds.includes(svc.id)"
              class="booking-new-checkbox"
              @change="toggleService(svc.id)"
            />
            <span class="booking-new-service-name">{{ svc.name }}</span>
          </label>
          <div class="booking-new-service-meta">
            <span class="booking-new-service-duration">{{ svc.durationMinutes }} min</span>
            <span class="booking-new-service-price">{{ formatPrice(svc.price) }}</span>
          </div>
        </div>
        <div v-if="selectedServicesTotal.duration > 0" class="booking-new-total">
          <div class="booking-new-total-label">Total</div>
          <div class="booking-new-total-duration">{{ selectedServicesTotal.duration }} min</div>
          <div class="booking-new-total-amount">{{ formatPrice(selectedServicesTotal.price) }}</div>
        </div>
      </VCard>

      <!-- Fecha y horario -->
      <VCard>
        <VSectionTitle>Fecha y horario</VSectionTitle>
        <div class="booking-new-row">
          <span class="booking-new-label">Fecha</span>
          <input type="date" :value="form.date" class="booking-new-date-input" @input="onDateInput" />
        </div>
        <div v-if="availableSlots.length > 0" class="booking-new-slots-wrap">
          <span class="booking-new-label booking-new-label--secondary">Horario</span>
          <div class="booking-new-slot-buttons">
            <button
              v-for="slot in availableSlots"
              :key="slot.start"
              type="button"
              :class="['booking-new-slot-btn', { 'booking-new-slot-btn--active': form.startTime === slot.start }]"
              @click="selectSlot(slot.start, slot.end)"
            >
              {{ slot.start }} – {{ slot.end }}
            </button>
          </div>
        </div>
        <p v-else-if="slotQueryReady && form.staffId && form.date && selectedServicesTotal.duration > 0" class="ds-muted">
          Sin horarios disponibles
        </p>
      </VCard>

      <!-- Cliente -->
      <VCard>
        <VSectionTitle>Cliente</VSectionTitle>
        <VListItem clickable @click="clientSheetOpen = true">
          <template #default>
            <template v-if="form.clientId">
              <span class="ds-value">{{ clientSummary }}</span>
              <span v-if="form.customer.dni" class="ds-sublabel">DNI {{ form.customer.dni }}</span>
            </template>
            <span v-else class="ds-placeholder">Elegir cliente</span>
          </template>
          <template #after>{{ form.clientId ? 'Cambiar' : 'Elegir' }}</template>
        </VListItem>
      </VCard>
      <ClientSheetPicker
        :opened="clientSheetOpen"
        :tenant-id="tenantId"
        @select="onClientSheetSelect"
        @close="clientSheetOpen = false"
      />

      <!-- Notas -->
      <VCard>
        <VSectionTitle>Notas</VSectionTitle>
        <textarea
          v-model="form.notes"
          class="ds-textarea"
          placeholder="Opcional"
          rows="3"
        />
      </VCard>

      <div class="ds-spacer" />
    </div>
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
import { getCurrentUser } from '../../../auth/session';
import StaffSheetPicker from '../../../components/StaffSheetPicker.vue';
import ClientSheetPicker from '../../../components/ClientSheetPicker.vue';
import VCard from '../../../components/ui/VCard.vue';
import VSectionTitle from '../../../components/ui/VSectionTitle.vue';
import VListItem from '../../../components/ui/VListItem.vue';
import {
  computeAvailableSlots,
  parseTime,
  validateNewBookingTimes,
  intervalsOverlap,
  type Schedule,
} from '../../../services/slotEngine';

const SLOT_STEP = 15;

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
  schedule?: Schedule;
  dayEnabled?: Record<string, boolean>;
  firstName?: string;
  lastName?: string;
}
const selectedStaffDoc = ref<StaffDoc | null>(null);
const bookingsForDate = ref<Array<{ startTime: string; endTime: string; status: string }>>([]);
const exceptionsForDate = ref<Array<{ date: string; type: 'full_day' | 'range'; start?: string | null; end?: string | null }>>([]);

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

const availableSlots = computed(() => {
  const staff = selectedStaffDoc.value;
  const date = form.date;
  const duration = selectedServicesTotal.value.duration;
  if (!staff?.schedule || !date || duration <= 0) return [];
  const schedule = staff.schedule ?? ({} as Schedule);
  const exceptions = exceptionsForDate.value;
  const bookings = bookingsForDate.value;
  const slots = computeAvailableSlots(
    schedule,
    exceptions,
    bookings,
    date,
    duration,
    SLOT_STEP,
    staff.dayEnabled ?? undefined
  );
  return slots.map((s) => ({ start: s.start, end: s.end }));
});

const slotQueryReady = ref(true);
watch(
  () => [form.staffId, form.date] as const,
  async ([sid, date]) => {
    const tid = tenantId.value;
    if (!tid || !sid || !date) {
      bookingsForDate.value = [];
      exceptionsForDate.value = [];
      return;
    }
    slotQueryReady.value = false;
    try {
      const db = getDbInstance();
      const [bookingsSnap, exceptionsSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'tenants', tid, 'bookings'),
            where('staffId', '==', sid),
            where('date', '==', date)
          )
        ),
        getDocs(
          query(
            collection(db, 'tenants', tid, 'staff', sid, 'exceptions'),
            where('date', '==', date)
          )
        ),
      ]);
      bookingsForDate.value = bookingsSnap.docs.map((d) => {
        const data = d.data();
        return {
          startTime: data.startTime ?? '',
          endTime: data.endTime ?? '',
          status: data.status ?? '',
        };
      });
      exceptionsForDate.value = exceptionsSnap.docs.map((d) => {
        const data = d.data();
        return {
          date: data.date ?? '',
          type: (data.type ?? 'full_day') as 'full_day' | 'range',
          start: data.start ?? null,
          end: data.end ?? null,
        };
      });
    } catch (e) {
      console.error('Error fetching bookings/exceptions:', e);
      bookingsForDate.value = [];
      exceptionsForDate.value = [];
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

function onNavSave(): void {
  if (canSave.value && !saving.value) handleSave();
}

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

    const rules = validateNewBookingTimes({
      schedule: (staff?.schedule ?? {}) as Schedule,
      dayEnabled: staff?.dayEnabled ?? undefined,
      date,
      startTime,
      endTime,
      totalDurationMinutes: selectedServicesTotal.value.duration,
      exceptions: exceptionsForDate.value,
      existingBookings: bookingsForDate.value,
    });
    if (!rules.ok) {
      slotTakenError.value = true;
      saving.value = false;
      return;
    }

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
    const user = getCurrentUser();
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
      statusHistory: [
        { at: Timestamp.now(), from: '', to: 'confirmed', by: { type: 'admin', id: user?.uid ?? null }, note: 'created' },
      ],
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
        if (intervalsOverlap(newStartMin, newEndMin, existingStart, existingEnd)) {
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
.booking-new-page .navbar .link.disabled {
  opacity: 0.5;
  pointer-events: none;
}
.ds-page-content {
  padding: var(--ds-space-2) var(--ds-space-2) 100px;
}
.ds-error-text {
  margin: 0;
  color: var(--f7-color-red);
  font-size: var(--ds-font-title);
  font-weight: 500;
}
.ds-value {
  font-size: var(--ds-font-body);
  font-weight: var(--ds-font-weight-body);
  color: var(--f7-text-color, #000);
}
.ds-placeholder {
  font-size: var(--ds-font-body);
  color: var(--f7-block-strong-text-color, #8e8e93);
}
.ds-sublabel {
  font-size: var(--ds-font-caption);
  opacity: 0.75;
  color: var(--f7-block-strong-text-color, #8e8e93);
}
.ds-muted {
  margin: var(--ds-space-1) 0 0;
  font-size: 0.875rem;
  opacity: 0.75;
  color: var(--f7-block-strong-text-color, #8e8e93);
}
.ds-textarea {
  width: 100%;
  font-size: var(--ds-font-body);
  padding: var(--ds-space-2);
  border-radius: var(--ds-input-radius);
  border: 1px solid var(--f7-list-item-border-color, #e5e5ea);
  background: var(--f7-page-bg-color, #f2f2f7);
  color: var(--f7-text-color, #000);
  resize: vertical;
  min-height: 72px;
  box-sizing: border-box;
}
.ds-textarea::placeholder {
  color: var(--f7-block-strong-text-color, #8e8e93);
  opacity: 0.8;
}
.ds-spacer {
  height: var(--ds-space-1);
}
.booking-new-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  gap: var(--ds-space-2);
}
.booking-new-label {
  font-size: var(--ds-font-title);
  font-weight: var(--ds-font-weight-body);
  color: var(--f7-text-color, #000);
}
.booking-new-label--secondary {
  font-size: var(--ds-font-caption);
  font-weight: 500;
  opacity: 0.8;
  margin-bottom: var(--ds-space-1);
}
.booking-new-date-input {
  font-size: var(--ds-font-body);
  padding: var(--ds-space-1) var(--ds-space-2);
  border-radius: var(--ds-input-radius);
  border: 1px solid var(--f7-list-item-border-color, #e5e5ea);
  background: var(--f7-page-bg-color, #f2f2f7);
  color: var(--f7-text-color, #000);
}

/* Servicios */
.booking-new-service-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ds-space-2);
  padding: var(--ds-space-2) 0;
  border-bottom: 1px solid var(--f7-list-item-border-color, #e5e5ea);
  cursor: pointer;
}

.booking-new-service-row:last-of-type {
  border-bottom: none;
}

.booking-new-service-label {
  display: flex;
  align-items: center;
  gap: var(--ds-space-2);
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.booking-new-checkbox {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  accent-color: var(--f7-theme-color, #007aff);
}

.booking-new-service-name {
  font-size: 1rem;
  font-weight: 500;
  color: var(--f7-text-color, #000);
}

.booking-new-service-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.booking-new-service-duration {
  font-size: 0.8125rem;
  opacity: 0.75;
  color: var(--f7-block-strong-text-color, #8e8e93);
}

.booking-new-service-price {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--f7-text-color, #000);
}

.booking-new-total {
  margin-top: var(--ds-space-2);
  padding-top: var(--ds-space-2);
  border-top: 2px solid var(--f7-list-item-border-color, #e5e5ea);
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--ds-space-1);
}

.booking-new-total-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--f7-block-title-color, #6d6d72);
  width: 100%;
}

.booking-new-total-duration {
  font-size: 0.8125rem;
  opacity: 0.8;
  color: var(--f7-block-strong-text-color, #8e8e93);
}

.booking-new-total-amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--f7-text-color, #000);
  margin-left: auto;
}

/* Slots */
.booking-new-slots-wrap {
  margin-top: var(--ds-space-2);
}
.booking-new-slot-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ds-space-1);
}
.booking-new-slot-btn {
  padding: var(--ds-space-1) var(--ds-space-2);
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--ds-input-radius);
  border: 1px solid var(--f7-list-item-border-color, #e5e5ea);
  background: var(--f7-page-bg-color, #f2f2f7);
  color: var(--f7-text-color, #000);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.booking-new-slot-btn--active {
  background: var(--f7-theme-color, #007aff);
  border-color: var(--f7-theme-color, #007aff);
  color: #fff;
}
</style>

<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar title="Extender turno" :back-link="'Atrás'" :back-link-url="bookingDetailUrl" />

    <f7-block v-if="loadError" strong inset>
      <p class="extend-booking-error">{{ loadError }}</p>
      <f7-button fill :href="bookingDetailUrl">Volver al turno</f7-button>
    </f7-block>

    <f7-block v-else-if="booking" strong inset>
      <template v-if="loading">
        <p class="extend-booking-muted">Cargando...</p>
      </template>
      <template v-else-if="!canExtend">
        <p class="extend-booking-muted">No hay espacio disponible para extender este turno.</p>
        <f7-button fill :href="bookingDetailUrl">Volver al turno</f7-button>
      </template>
      <template v-else>
        <p class="block-title">Resumen</p>
        <f7-list>
          <f7-list-item title="Cliente" :after="customerLabel" />
          <f7-list-item v-if="servicesLabel" title="Servicios" :after="servicesLabel" />
          <f7-list-item title="Horario actual" :after="`${booking.startTime} – ${booking.endTime}`" />
        </f7-list>

        <p class="block-title extend-booking-title">Timeline</p>
        <BookingExtensionTimeline
          :start-time="booking.startTime"
          :current-end-time="booking.endTime"
          :selected-end-time="selectedEndTime"
          :max-end-time="maxEndTime"
        />

        <p class="block-title">Nuevo horario de fin</p>
        <div class="extend-booking-slider-wrap">
          <input
            v-model.number="selectedIndex"
            type="range"
            class="extend-booking-range"
            :min="0"
            :max="Math.max(0, endTimeOptions.length - 1)"
            step="1"
          />
          <p class="extend-booking-range-label">{{ selectedEndTime }}</p>
        </div>

        <div class="extend-booking-summary">
          <p><strong>Nuevo horario:</strong> {{ booking.startTime }} – {{ selectedEndTime }}</p>
          <p><strong>Duración total:</strong> {{ newDurationMinutes }} min</p>
          <p v-if="minutesAdded > 0"><strong>Extensión agregada:</strong> +{{ minutesAdded }} min</p>
        </div>
        <p class="extend-booking-helper">Disponible hasta las {{ maxEndTime }}</p>

        <p v-if="extendError" class="extend-booking-error">{{ extendError }}</p>
        <f7-button fill large class="margin-top" :disabled="saving || !hasChange" @click="confirmExtend">
          {{ saving ? 'Guardando...' : 'Guardar extensión' }}
        </f7-button>
      </template>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { doc, getDoc } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';
import { f7ready } from 'framework7-vue';
import BookingExtensionTimeline from '../../../components/BookingExtensionTimeline.vue';
import { getMaxEndTime, getEndTimeOptions, extendBooking } from '../../../services/bookingExtension';
import { parseTime } from '../../../services/slotEngine';

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const bookingId = computed(() => (route.params.bookingId as string) ?? '');

const bookingDetailUrl = computed(() => `/t/${tenantId.value}/admin/agenda/booking/${bookingId.value}/`);

interface BookingData {
  date: string;
  startTime: string;
  endTime: string;
  staffId?: string;
  staffName?: string;
  customer?: { firstName?: string; lastName?: string };
  clientSnapshot?: { firstName?: string; lastName?: string };
  servicesSnapshot?: Array<{ name?: string }>;
}

const booking = ref<BookingData | null>(null);
const loading = ref(true);
const loadError = ref('');
const canExtend = ref(false);
const maxEndTime = ref('');
const extendError = ref('');
const saving = ref(false);

const endTimeOptions = ref<string[]>([]);
const selectedIndex = ref(0);

const currentEndTime = computed(() => booking.value?.endTime ?? '');
const selectedEndTime = computed(() => {
  const opts = endTimeOptions.value;
  const i = Math.max(0, Math.min(selectedIndex.value, opts.length - 1));
  return opts[i] ?? currentEndTime.value;
});

const customerLabel = computed(() => {
  const b = booking.value;
  const c = b?.customer ?? b?.clientSnapshot;
  if (!c) return '—';
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
});

const servicesLabel = computed(() => {
  const list = booking.value?.servicesSnapshot ?? [];
  if (!list.length) return '';
  return list.map((s) => s.name ?? '').filter(Boolean).join(', ');
});

const newDurationMinutes = computed(() => {
  const start = booking.value?.startTime ?? '';
  const end = selectedEndTime.value;
  if (!start || !end) return 0;
  return parseTime(end) - parseTime(start);
});

const minutesAdded = computed(() => {
  const cur = parseTime(currentEndTime.value);
  const sel = parseTime(selectedEndTime.value);
  return Math.max(0, sel - cur);
});

const hasChange = computed(() => selectedEndTime.value !== currentEndTime.value);

async function loadBooking(): Promise<void> {
  const tid = tenantId.value;
  const bid = bookingId.value;
  if (!tid || !bid) {
    loadError.value = 'Faltan datos del turno.';
    loading.value = false;
    return;
  }
  loading.value = true;
  loadError.value = '';
  const db = getDbInstance();
  try {
    const snap = await getDoc(doc(db, 'tenants', tid, 'bookings', bid));
    if (!snap.exists()) {
      loadError.value = 'No se encontró el turno.';
      loading.value = false;
      return;
    }
    const d = snap.data();
    booking.value = {
      date: d.date ?? '',
      startTime: d.startTime ?? '',
      endTime: d.endTime ?? '',
      staffId: d.staffId,
      staffName: d.staffName,
      customer: d.customer,
      clientSnapshot: d.clientSnapshot,
      servicesSnapshot: d.servicesSnapshot ?? [],
    };
  } catch (e) {
    console.error(e);
    loadError.value = 'No se pudo cargar el turno.';
  } finally {
    loading.value = false;
  }
}

async function loadMaxEnd(): Promise<void> {
  const b = booking.value;
  const tid = tenantId.value;
  const bid = bookingId.value;
  if (!tid || !bid || !b?.staffId || !b.date || !b.startTime || !b.endTime) {
    canExtend.value = false;
    return;
  }
  try {
    const result = await getMaxEndTime(tid, b.staffId, b.date, bid, b.startTime, b.endTime);
    canExtend.value = result.canExtend;
    maxEndTime.value = result.maxEndTime;
    const options = getEndTimeOptions(b.endTime, result.maxEndTime);
    endTimeOptions.value = options;
    const idx = options.indexOf(b.endTime);
    selectedIndex.value = idx >= 0 ? idx : 0;
  } catch (e) {
    console.error(e);
    canExtend.value = false;
    endTimeOptions.value = [];
    selectedIndex.value = 0;
  }
}

function showToast(text: string): void {
  f7ready((f7) => {
    f7.toast?.show?.({ text, closeTimeout: 2500 });
  });
}

const SAVE_TIMEOUT_MS = 20000;

async function confirmExtend(): Promise<void> {
  const b = booking.value;
  if (!b?.staffId || !b.date || !b.startTime || saving.value || !hasChange.value) return;
  if (parseTime(selectedEndTime.value) > parseTime(maxEndTime.value)) {
    extendError.value = 'El horario elegido supera el máximo disponible.';
    return;
  }
  saving.value = true;
  extendError.value = '';
  try {
    const savePromise = extendBooking({
      tenantId: tenantId.value,
      bookingId: bookingId.value,
      staffId: b.staffId,
      date: b.date,
      startTime: b.startTime,
      currentEndTime: b.endTime,
      newEndTime: selectedEndTime.value,
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Tardó demasiado. Intentá de nuevo.')), SAVE_TIMEOUT_MS);
    });
    await Promise.race([savePromise, timeoutPromise]);
    showToast('Turno extendido');
    await router.push(bookingDetailUrl.value);
  } catch (e) {
    extendError.value = (e as Error)?.message ?? 'No se pudo extender el turno.';
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await loadBooking();
  if (booking.value) await loadMaxEnd();
});
</script>

<style scoped>
.extend-booking-muted {
  color: var(--vitta-text-2, #9c8570);
}
.extend-booking-title {
  margin-top: 1rem;
}
.extend-booking-slider-wrap {
  margin: 0.75rem 0;
}
.extend-booking-range {
  width: 100%;
  height: 32px;
  accent-color: var(--vitta-text, #7c6a5a);
}
.extend-booking-range-label {
  margin: 0.25rem 0 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--vitta-text, #7c6a5a);
}
.extend-booking-summary {
  margin-top: 1rem;
  font-size: 0.9rem;
}
.extend-booking-summary p {
  margin: 0.25rem 0;
}
.extend-booking-helper {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--vitta-text-2, #9c8570);
}
.extend-booking-error {
  color: var(--f7-color-red, #e53935);
  margin-top: 0.5rem;
}
.margin-top {
  margin-top: 1rem;
}
</style>

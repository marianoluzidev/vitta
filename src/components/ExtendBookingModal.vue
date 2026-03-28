<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({ name: 'ExtendBookingModal' });
</script>
<template>
  <f7-popup class="extend-booking-popup" :opened="opened" @popup:closed="$emit('close')">
    <f7-page>
      <f7-navbar title="Extender turno">
        <f7-nav-right>
          <f7-link @click="$emit('close')">Cerrar</f7-link>
        </f7-nav-right>
      </f7-navbar>
      <f7-block strong inset>
        <template v-if="loading">
          <p class="extend-booking-muted">Cargando...</p>
        </template>
        <template v-else-if="!canExtend && !loading">
          <p class="extend-booking-muted">No hay espacio disponible para extender este turno.</p>
        </template>
        <template v-else>
          <p class="block-title">Resumen</p>
          <f7-list>
            <f7-list-item title="Cliente" :after="customerLabel" />
            <f7-list-item v-if="servicesLabel" title="Servicios" :after="servicesLabel" />
            <f7-list-item title="Horario actual" :after="`${booking?.startTime ?? ''} – ${booking?.endTime ?? ''}`" />
          </f7-list>

          <p class="block-title extend-booking-title">Timeline</p>
          <BookingExtensionTimeline
            :start-time="booking?.startTime ?? ''"
            :current-end-time="booking?.endTime ?? ''"
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
            <p><strong>Nuevo horario:</strong> {{ booking?.startTime }} – {{ selectedEndTime }}</p>
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
  </f7-popup>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import BookingExtensionTimeline from './BookingExtensionTimeline.vue';
import { getMaxEndTime, getEndTimeOptions, extendBooking } from '../services/bookingExtension';
import { parseTime } from '../services/slotEngine';

const props = defineProps<{
  opened: boolean;
  tenantId: string;
  bookingId: string;
  booking: {
    date: string;
    startTime: string;
    endTime: string;
    staffId?: string;
    staffName?: string;
    customer?: { firstName?: string; lastName?: string };
    clientSnapshot?: { firstName?: string; lastName?: string };
    servicesSnapshot?: Array<{ name?: string }>;
  } | null;
}>();

const emit = defineEmits<{ (e: 'close'): void; (e: 'done'): void }>();

const loading = ref(true);
const canExtend = ref(false);
const maxEndTime = ref('');
const rightBoundTime = ref('');
const extendError = ref('');
const saving = ref(false);

const endTimeOptions = ref<string[]>([]);
const selectedIndex = ref(0);
const currentEndTime = computed(() => props.booking?.endTime ?? '');
const selectedEndTime = computed(() => {
  const opts = endTimeOptions.value;
  const i = Math.max(0, Math.min(selectedIndex.value, opts.length - 1));
  return opts[i] ?? currentEndTime.value;
});

const customerLabel = computed(() => {
  const b = props.booking;
  const c = b?.customer ?? b?.clientSnapshot;
  if (!c) return '—';
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
});

const servicesLabel = computed(() => {
  const list = props.booking?.servicesSnapshot ?? [];
  if (!list.length) return '';
  return list.map((s) => s.name ?? '').filter(Boolean).join(', ');
});

const newDurationMinutes = computed(() => {
  const start = props.booking?.startTime ?? '';
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

async function loadMaxEnd(): Promise<void> {
  const { tenantId, bookingId, booking } = props;
  console.log('[ExtendModal] loadMaxEnd', {
    tenantId,
    bookingId,
    hasBooking: !!booking,
    staffId: booking?.staffId,
    date: booking?.date,
    startTime: booking?.startTime,
    endTime: booking?.endTime,
  });
  if (!tenantId || !bookingId || !booking?.staffId || !booking.date || !booking.startTime || !booking.endTime) {
    console.log('[ExtendModal] Salida temprana: faltan datos');
    canExtend.value = false;
    loading.value = false;
    return;
  }
  loading.value = true;
  extendError.value = '';
  try {
    const result = await getMaxEndTime(
      tenantId,
      booking.staffId,
      booking.date,
      bookingId,
      booking.startTime,
      booking.endTime
    );
    console.log('[ExtendModal] Resultado getMaxEndTime', result);
    canExtend.value = result.canExtend;
    maxEndTime.value = result.maxEndTime;
    rightBoundTime.value = result.rightBoundTime;
    const options = getEndTimeOptions(booking.endTime, result.maxEndTime);
    endTimeOptions.value = options;
    const idx = options.indexOf(booking.endTime);
    selectedIndex.value = idx >= 0 ? idx : 0;
  } catch (e) {
    console.error('[ExtendModal] Error getMaxEndTime', e);
    canExtend.value = false;
    endTimeOptions.value = [];
    selectedIndex.value = 0;
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.opened, props.bookingId, props.booking?.endTime] as const,
  ([open]) => {
    if (open && props.booking) loadMaxEnd();
  }
);


const SAVE_TIMEOUT_MS = 20000;

async function confirmExtend(): Promise<void> {
  const { tenantId, bookingId, booking } = props;
  if (!booking?.staffId || !booking.date || !booking.startTime || saving.value || !hasChange.value) return;
  if (parseTime(selectedEndTime.value) > parseTime(maxEndTime.value)) {
    extendError.value = 'El horario elegido supera el máximo disponible.';
    return;
  }
  saving.value = true;
  extendError.value = '';
  try {
    const savePromise = extendBooking({
      tenantId,
      bookingId,
      staffId: booking.staffId,
      date: booking.date,
      startTime: booking.startTime,
      currentEndTime: booking.endTime,
      newEndTime: selectedEndTime.value,
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Tardó demasiado. Intentá de nuevo.')), SAVE_TIMEOUT_MS);
    });
    await Promise.race([savePromise, timeoutPromise]);

    saving.value = false;
    await nextTick();
    emit('done');
    emit('close');
  } catch (e) {
    extendError.value = (e as Error)?.message ?? 'No se pudo extender el turno.';
    saving.value = false;
  }
}
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

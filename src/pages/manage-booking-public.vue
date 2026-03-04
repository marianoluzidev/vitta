<template>
  <f7-page class="manage-booking-public-page tenant-login">
    <f7-navbar :title="info ? `Mi turno · ${info.tenantName}` : 'Gestionar turno'" />

    <f7-block v-if="loading" strong inset>
      <p>Cargando...</p>
    </f7-block>

    <f7-block v-else-if="errorMessage" strong inset>
      <p class="text-color-red">{{ errorMessage }}</p>
      <f7-link href="#" @click.prevent="goToBook">Reservar un turno</f7-link>
    </f7-block>

    <template v-else-if="info">
      <f7-block strong inset>
        <p class="block-title">Tu turno</p>
        <p><strong>{{ info.date }}</strong> · {{ info.startTime }} – {{ info.endTime }}</p>
        <p><span :class="['badge', statusBadgeClass(info.status)]">{{ statusLabel(info.status) }}</span></p>
        <p v-if="info.staffName">Staff: {{ info.staffName }}</p>
        <p v-if="info.servicesSnapshot?.length">Servicios: {{ serviceNames(info.servicesSnapshot) }}</p>
      </f7-block>

      <f7-block v-if="info.canCancel && !showCancelForm" strong inset>
        <f7-button fill small :disabled="saving" @click="showCancelForm = true">Cancelar turno</f7-button>
      </f7-block>
      <f7-block v-else-if="showCancelForm" strong inset>
        <p class="block-title">Motivo (opcional)</p>
        <f7-list-input label="" type="textarea" placeholder="Ej: cambio de planes" v-model:value="cancelReason" :disabled="saving" />
        <f7-button fill small class="margin-top" :disabled="saving" @click="confirmCancel">Confirmar cancelación</f7-button>
        <f7-button class="margin-top" small :disabled="saving" @click="showCancelForm = false">Volver</f7-button>
      </f7-block>

      <f7-block v-if="info.canReschedule && !cancelled" strong inset>
        <f7-button fill small :disabled="saving" @click="showRescheduleModal = true">Reprogramar</f7-button>
      </f7-block>

      <f7-block strong inset>
        <f7-link href="#" @click.prevent="goToBook">Reservar otro turno</f7-link>
      </f7-block>

      <!-- Modal reprogramar -->
      <f7-popup class="reschedule-popup" :opened="showRescheduleModal" @popup:closed="showRescheduleModal = false">
        <f7-page>
          <f7-navbar title="Reprogramar" :back-link="'Cerrar'" @back-click="showRescheduleModal = false" />
          <f7-block strong inset>
            <f7-list-item title="Nueva fecha">
              <template #after>
                <input type="date" :value="rescheduleDate" :min="todayStr" @input="onRescheduleDateInput" />
              </template>
            </f7-list-item>
            <f7-block v-if="rescheduleDate && info" class="slot-loading" v-show="rescheduleSlotsLoading"><p>Cargando...</p></f7-block>
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
            <p v-if="rescheduleError" class="text-color-red">{{ rescheduleError }}</p>
            <f7-button fill large class="margin-top" :disabled="!rescheduleDate || !rescheduleStart || saving" @click="confirmReschedule">Guardar</f7-button>
          </f7-block>
        </f7-page>
      </f7-popup>
    </template>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { f7ready } from 'framework7-vue';
import {
  validateManageToken,
  cancelBookingPublic,
  rescheduleBookingPublic,
  getAvailableSlots,
  type ManageBookingInfo,
} from '../services/publicBookingApi';

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const bookingId = computed(() => (route.params.bookingId as string) ?? '');
const token = computed(() => (route.query.token as string) ?? '');

const loading = ref(true);
const errorMessage = ref('');
const info = ref<ManageBookingInfo | null>(null);
const saving = ref(false);
const showCancelForm = ref(false);
const cancelReason = ref('');
const cancelled = ref(false);
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
  const map: Record<string, string> = { confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Completado', no_show: 'No asistió' };
  return map[s] ?? s;
}
function statusBadgeClass(s: string): string {
  if (s === 'confirmed' || s === 'completed') return 'color-green';
  if (s === 'cancelled' || s === 'no_show') return 'color-red';
  return 'color-orange';
}
function serviceNames(snapshot: Array<{ name?: string }>): string {
  return (snapshot || []).map((s) => s.name ?? '').filter(Boolean).join(', ');
}

function showToast(text: string): void {
  f7ready((f7) => f7.toast?.show?.({ text, closeTimeout: 2500 }));
}

function goToBook(): void {
  router.push(`/t/${tenantId.value}/book/`);
}

async function load(): Promise<void> {
  const tid = tenantId.value;
  const bid = bookingId.value;
  const t = token.value?.trim();
  if (!tid || !bid || !t) {
    errorMessage.value = 'Link inválido. Falta token.';
    loading.value = false;
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  try {
    info.value = await validateManageToken(tid, bid, t);
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string };
    errorMessage.value = err?.message ?? 'No se pudo cargar el turno.';
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
  () => [rescheduleDate.value, info.value?.staffId, info.value?.totalDurationMinutes] as const,
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
    } catch {
      rescheduleSlots.value = [];
    } finally {
      rescheduleSlotsLoading.value = false;
    }
  }
);

watch(showRescheduleModal, (open) => {
  if (open && info.value) {
    rescheduleDate.value = info.value.date;
    rescheduleStart.value = '';
    rescheduleEnd.value = '';
    rescheduleError.value = '';
  }
});

async function confirmCancel(): Promise<void> {
  const tid = tenantId.value;
  const bid = bookingId.value;
  const t = token.value?.trim();
  if (!tid || !bid || !t || saving.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    await cancelBookingPublic(tid, bid, t, cancelReason.value.trim() || undefined);
    cancelled.value = true;
    if (info.value) info.value = { ...info.value, status: 'cancelled', canCancel: false, canReschedule: false };
    showCancelForm.value = false;
    cancelReason.value = '';
    showToast('Turno cancelado');
  } catch (e: unknown) {
    const err = e as { message?: string };
    errorMessage.value = err?.message ?? 'No se pudo cancelar.';
  } finally {
    saving.value = false;
  }
}

async function confirmReschedule(): Promise<void> {
  const tid = tenantId.value;
  const bid = bookingId.value;
  const t = token.value?.trim();
  if (!tid || !bid || !t || !rescheduleDate.value || !rescheduleStart.value || !rescheduleEnd.value || saving.value) return;
  saving.value = true;
  rescheduleError.value = '';
  try {
    await rescheduleBookingPublic(tid, bid, t, rescheduleDate.value, rescheduleStart.value, rescheduleEnd.value);
    if (info.value) {
      info.value = {
        ...info.value,
        date: rescheduleDate.value,
        startTime: rescheduleStart.value,
        endTime: rescheduleEnd.value,
      };
    }
    showRescheduleModal.value = false;
    rescheduleDate.value = '';
    rescheduleStart.value = '';
    rescheduleEnd.value = '';
    rescheduleSlots.value = [];
    showToast('Turno reprogramado');
  } catch (e: unknown) {
    const err = e as { message?: string };
    rescheduleError.value = err?.message === 'SLOT_TAKEN' ? 'Ese horario ya no está disponible.' : (err?.message ?? 'No se pudo reprogramar.');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.margin-top {
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

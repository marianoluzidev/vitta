<template>
  <f7-page class="public-book-page tenant-login">
    <f7-navbar :title="tenantName ? `Reservar · ${tenantName}` : 'Reservar turno'" />

    <f7-block v-if="checkingTenant" class="block-strong">
      <p>Cargando...</p>
    </f7-block>

    <template v-else>
      <!-- Progress -->
      <f7-block strong class="wizard-progress">
        <f7-segmented strong>
          <f7-button :fill="step === 1" small>Paso 1</f7-button>
          <f7-button :fill="step === 2" small>Paso 2</f7-button>
          <f7-button :fill="step === 3" small>Paso 3</f7-button>
        </f7-segmented>
      </f7-block>

      <!-- Step 1: Servicios + Staff + Fecha + Hora -->
      <f7-block v-show="step === 1" strong inset>
        <p class="block-title">Elegí servicios y horario</p>
        <f7-list v-if="services.length > 0">
          <f7-list-item v-for="svc in services" :key="svc.id" :title="svc.name" checkbox :checked="form.serviceIds.includes(svc.id)" @change="toggleService(svc.id)">
            <template #after>{{ svc.durationMinutes }} min · {{ formatPrice(svc.price) }}</template>
          </f7-list-item>
        </f7-list>
        <p v-else class="text-color-gray">No hay servicios cargados.</p>

        <f7-list-item v-if="staffList.length > 0" title="Profesional" group-title />
        <f7-list v-if="staffList.length > 0">
          <f7-list-item
            v-for="s in staffList"
            :key="s.id"
            :title="fullName(s)"
            :link="form.staffId !== s.id"
            :class="{ 'item-selected': form.staffId === s.id }"
            @click="selectStaff(s.id)"
          />
        </f7-list>

        <f7-list-item title="Fecha" />
        <f7-list-item>
          <template #after>
            <input type="date" :value="form.date" :min="minDate" :max="maxDate" @input="onDateInput" />
          </template>
        </f7-list-item>

        <template v-if="form.staffId && form.date && totalDuration > 0">
          <f7-list-item title="Horario" group-title />
          <f7-block v-if="slotsLoading" class="slot-loading"><p>Cargando horarios...</p></f7-block>
          <f7-block v-else-if="availableSlots.length > 0" class="slot-buttons">
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
          <f7-block v-else><p class="text-color-gray">Sin horarios disponibles para esta fecha.</p></f7-block>
        </template>

        <f7-button v-if="step === 1" fill large class="margin-top" :disabled="!canAdvanceStep1" @click="step = 2">Siguiente</f7-button>
      </f7-block>

      <!-- Step 2: DNI + datos cliente -->
      <f7-block v-show="step === 2" strong inset>
        <p class="block-title">Tus datos</p>
        <f7-list form>
          <f7-list-input
            label="DNI (obligatorio)"
            type="text"
            inputmode="numeric"
            v-model:value="form.client.dni"
            placeholder="Solo números"
            @blur="lookupDni"
          />
          <f7-block v-if="clientFound" class="client-found"><p>Cliente encontrado. Podés editar los datos abajo.</p></f7-block>
          <f7-list-input label="Nombre" type="text" v-model:value="form.client.firstName" placeholder="Nombre" />
          <f7-list-input label="Apellido" type="text" v-model:value="form.client.lastName" placeholder="Apellido" />
          <f7-list-input label="Teléfono" type="tel" v-model:value="form.client.phone" placeholder="Opcional" />
          <f7-list-input label="Email" type="email" v-model:value="form.client.email" placeholder="Para confirmación por email" />
        </f7-list>
        <f7-block v-if="step2Error" class="error-block"><p>{{ step2Error }}</p></f7-block>
        <f7-button v-if="step === 2" fill large class="margin-top" :disabled="!canAdvanceStep2" @click="validateStep2AndAdvance">Siguiente</f7-button>
        <f7-button class="margin-top" outline @click="step = 1">Atrás</f7-button>
      </f7-block>

      <!-- Step 3: Confirmación -->
      <f7-block v-show="step === 3" strong inset>
        <p class="block-title">Confirmar reserva</p>
        <f7-list>
          <f7-list-item title="Servicios" :after="summaryServices" />
          <f7-list-item title="Duración" :after="`${totalDuration} min`" />
          <f7-list-item title="Profesional" :after="summaryStaffName" />
          <f7-list-item title="Fecha" :after="form.date" />
          <f7-list-item title="Horario" :after="`${form.startTime} – ${form.endTime}`" />
          <f7-list-item title="Cliente" :after="summaryClientName" />
          <f7-list-item title="DNI" :after="form.client.dni" />
          <f7-list-item v-if="totalPrice > 0" title="Total" :after="formatPrice(totalPrice)" />
        </f7-list>
        <f7-block v-if="!form.client.email.trim()" class="no-email-warn">
          <p>No ingresaste email: no podremos enviarte confirmación por correo.</p>
        </f7-block>
        <f7-block v-if="confirmError" class="error-block"><p>{{ confirmError }}</p></f7-block>
        <f7-button v-if="step === 3 && !confirmed" fill large class="margin-top" :disabled="confirming" @click="confirmBooking">Confirmar reserva</f7-button>
        <f7-button v-if="step === 3 && !confirmed" class="margin-top" outline @click="step = 2">Atrás</f7-button>
      </f7-block>

      <!-- Post-confirm success -->
      <f7-block v-if="confirmed" strong inset class="success-block">
        <p class="block-title">Reserva confirmada</p>
        <p>Tu turno fue registrado correctamente.</p>
        <p v-if="form.client.email.trim()">Te enviamos un email de confirmación.</p>
        <p><strong>Fecha:</strong> {{ form.date }} · <strong>Horario:</strong> {{ form.startTime }} – {{ form.endTime }}</p>
        <f7-button fill large href="#" @click.prevent="goToMyBookings">Ver mis turnos</f7-button>
      </f7-block>
    </template>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { getDbInstance } from '../firebase/firebase';
import { getTenant } from '../tenant/tenantService';
import {
  getAvailableSlots,
  createPublicBooking,
  findClientByDni,
  type SlotOption,
} from '../services/publicBookingApi';

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const checkingTenant = ref(true);
const tenantName = ref('');

const step = ref(1);
const services = ref<Array<{ id: string; name: string; price: number; durationMinutes: number; active: boolean }>>([]);
const staffList = ref<Array<{ id: string; firstName: string; lastName: string; active: boolean }>>([]);
const availableSlots = ref<SlotOption[]>([]);
const slotsLoading = ref(false);
const clientFound = ref(false);
const step2Error = ref('');
const confirmError = ref('');
const confirming = ref(false);
const confirmed = ref(false);

const form = reactive({
  serviceIds: [] as string[],
  staffId: '',
  date: '',
  startTime: '',
  endTime: '',
  client: {
    dni: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  },
});

const today = new Date();
const minDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
const maxDate = (() => {
  const d = new Date(today);
  d.setDate(d.getDate() + 60);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
})();

const totalDuration = computed(() => {
  return form.serviceIds.reduce((acc, id) => {
    const s = services.value.find((x) => x.id === id);
    return acc + (s?.durationMinutes ?? 0);
  }, 0);
});
const totalPrice = computed(() => {
  return form.serviceIds.reduce((acc, id) => {
    const s = services.value.find((x) => x.id === id);
    return acc + (s?.price ?? 0);
  }, 0);
});

const canAdvanceStep1 = computed(() => {
  return form.serviceIds.length > 0 && form.staffId && form.date && form.startTime && form.endTime && totalDuration.value > 0;
});

const canAdvanceStep2 = computed(() => {
  const d = form.client.dni.trim();
  const first = form.client.firstName.trim();
  const last = form.client.lastName.trim();
  return d.length >= 7 && d.length <= 9 && (first.length > 0 || last.length > 0);
});

const summaryServices = computed(() => {
  return form.serviceIds
    .map((id) => services.value.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(', ') || '—';
});
const summaryStaffName = computed(() => {
  const s = staffList.value.find((x) => x.id === form.staffId);
  return s ? [s.firstName, s.lastName].filter(Boolean).join(' ') || '—' : '—';
});
const summaryClientName = computed(() => {
  const a = form.client.firstName.trim();
  const b = form.client.lastName.trim();
  return [a, b].filter(Boolean).join(' ') || '—';
});

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(price);
}
function fullName(s: { firstName: string; lastName: string }): string {
  return [s.firstName, s.lastName].filter(Boolean).join(' ') || '—';
}

function toggleService(id: string): void {
  const idx = form.serviceIds.indexOf(id);
  if (idx === -1) form.serviceIds.push(id);
  else form.serviceIds.splice(idx, 1);
  form.startTime = '';
  form.endTime = '';
  availableSlots.value = [];
}

function selectStaff(id: string): void {
  form.staffId = id;
  form.startTime = '';
  form.endTime = '';
  availableSlots.value = [];
}

function onDateInput(e: Event): void {
  form.date = (e.target as HTMLInputElement).value ?? '';
  form.startTime = '';
  form.endTime = '';
  availableSlots.value = [];
}

function selectSlot(start: string, end: string): void {
  form.startTime = start;
  form.endTime = end;
}

async function loadSlots(): Promise<void> {
  const tid = tenantId.value;
  if (!tid || !form.staffId || !form.date || totalDuration.value <= 0) return;
  slotsLoading.value = true;
  availableSlots.value = [];
  try {
    const slots = await getAvailableSlots(tid, form.staffId, form.date, totalDuration.value);
    availableSlots.value = slots;
  } catch (e) {
    console.error('Error loading slots', e);
  } finally {
    slotsLoading.value = false;
  }
}

watch(
  () => [form.staffId, form.date, totalDuration.value] as const,
  () => {
    if (form.staffId && form.date && totalDuration.value > 0) loadSlots();
    else availableSlots.value = [];
  },
  { immediate: true }
);

let dniLookupTimeout: ReturnType<typeof setTimeout> | null = null;
async function lookupDni(): Promise<void> {
  const d = form.client.dni.trim().replace(/\D/g, '');
  form.client.dni = d;
  if (d.length < 7) {
    clientFound.value = false;
    return;
  }
  if (dniLookupTimeout) clearTimeout(dniLookupTimeout);
  dniLookupTimeout = setTimeout(async () => {
    const tid = tenantId.value;
    if (!tid) return;
    try {
      const client = await findClientByDni(tid, d);
      if (client) {
        form.client.firstName = client.firstName ?? '';
        form.client.lastName = client.lastName ?? '';
        form.client.phone = client.phone ?? '';
        form.client.email = client.email ?? '';
        clientFound.value = true;
      } else {
        clientFound.value = false;
      }
    } catch (e) {
      clientFound.value = false;
    }
    dniLookupTimeout = null;
  }, 300);
}

function validateEmail(email: string): boolean {
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function validateStep2AndAdvance(): void {
  step2Error.value = '';
  const d = form.client.dni.trim();
  const first = form.client.firstName.trim();
  const last = form.client.lastName.trim();
  if (d.length < 7 || d.length > 9) {
    step2Error.value = 'DNI debe tener entre 7 y 9 dígitos.';
    return;
  }
  if (!first && !last) {
    step2Error.value = 'Ingresá nombre o apellido.';
    return;
  }
  if (!validateEmail(form.client.email)) {
    step2Error.value = 'Email inválido.';
    return;
  }
  step.value = 3;
  confirmError.value = '';
}

async function confirmBooking(): Promise<void> {
  confirmError.value = '';
  const tid = tenantId.value;
  if (!tid || !form.staffId || !form.date || !form.startTime || !form.endTime) return;
  confirming.value = true;
  try {
    const result = await createPublicBooking(tid, {
      staffId: form.staffId,
      serviceIds: [...form.serviceIds],
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      client: {
        dni: form.client.dni.trim(),
        firstName: form.client.firstName.trim(),
        lastName: form.client.lastName.trim(),
        phone: form.client.phone.trim(),
        email: form.client.email.trim(),
      },
    });
    if (result.success) {
      confirmed.value = true;
    } else {
      confirmError.value = result.message ?? 'No se pudo completar la reserva.';
    }
  } catch (e: any) {
    const code = e?.code ?? e?.message ?? '';
    if (code === 'failed-precondition' || (typeof code === 'string' && code.includes('SLOT_TAKEN'))) {
      confirmError.value = 'Ese horario ya no está disponible. Elegí otro en el Paso 1.';
      step.value = 1;
      loadSlots();
    } else {
      confirmError.value = e?.message ?? 'Error al confirmar. Intentá de nuevo.';
    }
  } finally {
    confirming.value = false;
  }
}

function goToMyBookings(): void {
  router.push(`/t/${tenantId.value}/mis-turnos/`);
}

onMounted(async () => {
  const tid = tenantId.value;
  if (!tid) {
    checkingTenant.value = false;
    return;
  }
  try {
    const tenant = await getTenant(tid);
    if (!tenant) {
      router.push('/tenant-not-found/');
      return;
    }
    if ((tenant as any).isActive === false) {
      router.push('/tenant-disabled/');
      return;
    }
    tenantName.value = (tenant as any).name ?? '';

    const db = getDbInstance();
    const [servicesSnap, staffSnap] = await Promise.all([
      getDocs(collection(db, 'tenants', tid, 'services')),
      getDocs(query(collection(db, 'tenants', tid, 'staff'), where('active', '==', true))),
    ]);
    services.value = servicesSnap.docs
      .filter((d) => d.data().active !== false)
      .map((d) => ({
        id: d.id,
        name: d.data().name ?? '',
        price: d.data().price ?? 0,
        durationMinutes: d.data().durationMinutes ?? 0,
        active: d.data().active !== false,
      }));
    staffList.value = staffSnap.docs.map((d) => ({
      id: d.id,
      firstName: d.data().firstName ?? '',
      lastName: d.data().lastName ?? '',
      active: d.data().active !== false,
    }));

    const t = new Date();
    form.date = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
  } catch (e) {
    console.error(e);
    router.push('/tenant-not-found/');
  } finally {
    checkingTenant.value = false;
  }
});
</script>

<style scoped>
.public-book-page .block-title {
  margin-bottom: 0.75rem;
  font-weight: 600;
}
.wizard-progress {
  margin-bottom: 0;
}
.slot-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.slot-buttons .button {
  margin: 0;
}
.slot-loading {
  margin-top: 0.5rem;
}
.client-found {
  background: var(--vitta-accent, #34c759);
  color: #fff;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  margin: 0.5rem 0;
}
.client-found p {
  margin: 0;
  font-size: 0.9rem;
}
.error-block p {
  margin: 0;
  color: var(--f7-color-red);
  font-size: 0.9rem;
}
.no-email-warn {
  background: #fff3cd;
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
}
.no-email-warn p {
  margin: 0;
  font-size: 0.85rem;
}
.success-block .block-title {
  color: var(--vitta-accent, #34c759);
}
.item-selected {
  font-weight: 600;
}
.margin-top {
  margin-top: 1rem;
}
</style>

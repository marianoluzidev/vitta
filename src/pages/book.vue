<template>
  <f7-page class="public-book-page tenant-login">
    <f7-navbar :title="tenantName ? `Reservar · ${tenantName}` : 'Reservar turno'" />

    <div v-if="checkingTenant" class="ds-page-content">
      <VCard>
        <p class="ds-muted">Cargando...</p>
      </VCard>
    </div>

    <template v-else>
      <div class="ds-page-content">
        <div v-if="logoUrl" class="book-logo-wrap">
          <img
            :src="logoUrl"
            :alt="`Logo de ${tenantName}`"
            class="book-logo"
            @error="onLogoError"
          />
        </div>
        <!-- Progress -->
        <VCard>
          <div class="book-wizard-steps">
            <button type="button" :class="['book-step-dot', { 'book-step-dot--active': step === 1 }]" @click="step = 1">1</button>
            <button type="button" :class="['book-step-dot', { 'book-step-dot--active': step === 2 }]" @click="step = 2">2</button>
            <button type="button" :class="['book-step-dot', { 'book-step-dot--active': step === 3 }]" @click="step = 3">3</button>
          </div>
          <p class="ds-caption">Paso {{ step }} de 3</p>
        </VCard>

        <!-- Step 1: Servicios + Staff + Fecha + Hora -->
        <VCard v-show="step === 1">
          <VSectionTitle>Elegí servicios y horario</VSectionTitle>
          <template v-if="services.length > 0">
            <div v-for="svc in services" :key="svc.id" class="book-service-row">
              <label class="book-service-label">
                <input type="checkbox" :checked="form.serviceIds.includes(svc.id)" class="book-checkbox" @change="toggleService(svc.id)" />
                <span class="book-service-name">{{ svc.name }}</span>
              </label>
              <div class="book-service-meta">
                <span class="book-service-duration">{{ svc.durationMinutes }} min</span>
                <span class="book-service-price">{{ formatPrice(svc.price) }}</span>
              </div>
            </div>
          </template>
          <p v-else class="ds-muted">No hay servicios cargados.</p>

          <template v-if="staffList.length > 0">
            <p class="ds-label book-label-top">Profesional</p>
            <div class="book-staff-list">
              <button
                v-for="s in staffList"
                :key="s.id"
                type="button"
                :class="['book-staff-btn', { 'book-staff-btn--active': form.staffId === s.id }]"
                @click="selectStaff(s.id)"
              >
                {{ fullName(s) }}
              </button>
            </div>
          </template>

          <VFormField label="Fecha">
            <input type="date" :value="form.date" :min="minDate" :max="maxDate" class="ds-input" @input="onDateInput" />
          </VFormField>

          <template v-if="form.staffId && form.date && totalDuration > 0">
            <p class="ds-label book-label-top">Horario</p>
            <p v-if="slotsLoading" class="ds-muted">Cargando horarios...</p>
            <div v-else-if="availableSlots.length > 0" class="book-slot-buttons">
              <button
                v-for="slot in availableSlots"
                :key="slot.start"
                type="button"
                :class="['book-slot-btn', { 'book-slot-btn--active': form.startTime === slot.start }]"
                @click="selectSlot(slot.start, slot.end)"
              >
                {{ slot.start }} – {{ slot.end }}
              </button>
            </div>
            <p v-else class="ds-muted">Sin horarios disponibles para esta fecha.</p>
          </template>
        </VCard>

        <!-- Step 2: DNI + datos cliente -->
        <VCard v-show="step === 2">
          <VSectionTitle>Tus datos</VSectionTitle>
          <VFormField label="DNI (obligatorio)">
            <input
              v-model="form.client.dni"
              type="text"
              inputmode="numeric"
              placeholder="Solo números"
              class="ds-input"
              @blur="lookupDni"
            />
          </VFormField>
          <div v-if="clientFound" class="book-client-found">
            <p>Cliente encontrado. Podés editar los datos abajo.</p>
          </div>
          <VFormField label="Nombre">
            <input v-model="form.client.firstName" type="text" placeholder="Nombre" class="ds-input" />
          </VFormField>
          <VFormField label="Apellido">
            <input v-model="form.client.lastName" type="text" placeholder="Apellido" class="ds-input" />
          </VFormField>
          <VFormField label="Teléfono">
            <input v-model="form.client.phone" type="tel" placeholder="Opcional" class="ds-input" />
          </VFormField>
          <VFormField label="Email">
            <input v-model="form.client.email" type="email" placeholder="Para confirmación por email" class="ds-input" />
          </VFormField>
          <p v-if="step2Error" class="ds-error-text">{{ step2Error }}</p>
          <p class="book-back-link">
            <a href="#" @click.prevent="step = 1">Atrás</a>
          </p>
        </VCard>

        <!-- Step 3: Confirmación -->
        <VCard v-show="step === 3 && !confirmed">
          <VSectionTitle>Confirmar reserva</VSectionTitle>
          <VListItem title="Servicios"><template #after>{{ summaryServices }}</template></VListItem>
          <VListItem title="Duración"><template #after>{{ totalDuration }} min</template></VListItem>
          <VListItem title="Profesional"><template #after>{{ summaryStaffName }}</template></VListItem>
          <VListItem title="Fecha"><template #after>{{ form.date }}</template></VListItem>
          <VListItem title="Horario"><template #after>{{ form.startTime }} – {{ form.endTime }}</template></VListItem>
          <VListItem title="Cliente"><template #after>{{ summaryClientName }}</template></VListItem>
          <VListItem title="DNI"><template #after>{{ form.client.dni }}</template></VListItem>
          <VListItem v-if="totalPrice > 0" title="Total"><template #after>{{ formatPrice(totalPrice) }}</template></VListItem>
          <div v-if="!form.client.email.trim()" class="book-no-email">
            <p>No ingresaste email: no podremos enviarte confirmación por correo.</p>
          </div>
          <p v-if="confirmError" class="ds-error-text">{{ confirmError }}</p>
          <p class="book-back-link">
            <a href="#" @click.prevent="step = 2">Atrás</a>
          </p>
        </VCard>

        <!-- Post-confirm success -->
        <VCard v-if="confirmed" class="book-success-card">
          <VSectionTitle>Reserva confirmada</VSectionTitle>
          <p class="ds-muted">Tu turno fue registrado correctamente.</p>
          <p v-if="form.client.email.trim()" class="ds-muted">Te enviamos un email de confirmación.</p>
          <p class="book-success-datetime"><strong>Fecha:</strong> {{ form.date }} · <strong>Horario:</strong> {{ form.startTime }} – {{ form.endTime }}</p>
        </VCard>

        <div class="ds-spacer" />
      </div>

      <!-- Fixed footer: primary action -->
      <VFixedFooter v-if="!checkingTenant && !confirmed">
        <VPrimaryButton
          v-if="step === 1"
          label="Siguiente"
          :disabled="!canAdvanceStep1"
          full-width
          @click="step = 2"
        />
        <VPrimaryButton
          v-else-if="step === 2"
          label="Siguiente"
          :disabled="!canAdvanceStep2"
          full-width
          @click="validateStep2AndAdvance"
        />
        <VPrimaryButton
          v-else-if="step === 3"
          :label="confirming ? 'Confirmando...' : 'Confirmar reserva'"
          :disabled="confirming"
          full-width
          @click="confirmBooking"
        />
      </VFixedFooter>
      <VFixedFooter v-if="!checkingTenant && confirmed">
        <VPrimaryButton label="Ver mis turnos" full-width @click="goToMyBookings" />
      </VFixedFooter>
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
import VCard from '../components/ui/VCard.vue';
import VSectionTitle from '../components/ui/VSectionTitle.vue';
import VFormField from '../components/ui/VFormField.vue';
import VListItem from '../components/ui/VListItem.vue';
import VPrimaryButton from '../components/ui/VPrimaryButton.vue';
import VFixedFooter from '../components/ui/VFixedFooter.vue';

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const checkingTenant = ref(true);
const tenantName = ref('');

const step = ref(1);
const logoError = ref(false);
const logoUrl = computed(() => {
  const tid = tenantId.value;
  if (!tid || logoError.value) return null;
  return `/branding/${tid}/logo.png`;
});
function onLogoError(): void {
  logoError.value = true;
}
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
.ds-page-content {
  padding: var(--ds-space-2) var(--ds-space-2) 100px;
}
.book-logo-wrap {
  text-align: center;
  margin-bottom: var(--ds-space-2);
}
.book-logo {
  max-height: 80px;
  max-width: 220px;
  width: auto;
  height: auto;
  object-fit: contain;
  display: inline-block;
}
.ds-input {
  width: 100%;
  font-size: var(--ds-font-body);
  padding: var(--ds-space-1) var(--ds-space-2);
  border-radius: var(--ds-input-radius);
  border: 1px solid var(--vitta-divider, var(--f7-list-item-border-color, #e5e5ea));
  background: var(--vitta-surface, var(--f7-page-bg-color, #f2f2f7));
  color: var(--vitta-text, var(--f7-text-color, #333));
  box-sizing: border-box;
}
.ds-caption {
  margin: var(--ds-space-1) 0 0;
  font-size: var(--ds-font-caption);
  color: var(--vitta-text-2, var(--f7-block-strong-text-color, #666));
}
.book-wizard-steps {
  display: flex;
  gap: var(--ds-space-2);
  margin-bottom: var(--ds-space-1);
}
.book-step-dot {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--vitta-divider, var(--f7-list-item-border-color, #e5e5ea));
  background: var(--vitta-surface, var(--f7-page-bg-color, #f2f2f7));
  font-weight: 600;
  font-size: 0.9375rem;
  color: var(--vitta-text, var(--f7-text-color, #333));
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.book-step-dot--active {
  background: var(--vitta-text, var(--f7-theme-color, #7C6A5A));
  border-color: var(--vitta-text, var(--f7-theme-color, #7C6A5A));
  color: #fff;
}
.book-label-top {
  margin: var(--ds-space-2) 0 var(--ds-space-1);
}
.book-service-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ds-space-2);
  padding: var(--ds-space-2) 0;
  border-bottom: 1px solid var(--vitta-divider, var(--f7-list-item-border-color, #e5e5ea));
  cursor: pointer;
}
.book-service-row:last-of-type {
  border-bottom: none;
}
.book-service-label {
  display: flex;
  align-items: center;
  gap: var(--ds-space-2);
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.book-checkbox {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  accent-color: var(--vitta-text, var(--f7-theme-color, #7C6A5A));
}
.book-service-name {
  font-size: var(--ds-font-body);
  font-weight: var(--ds-font-weight-body);
  color: var(--vitta-text, var(--f7-text-color, #333));
}
.book-service-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}
.book-service-duration {
  font-size: var(--ds-font-caption);
  opacity: 0.75;
  color: var(--vitta-text-2, var(--f7-block-strong-text-color, #666));
}
.book-service-price {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--vitta-text, var(--f7-text-color, #333));
}
.book-staff-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ds-space-1);
}
.book-staff-btn {
  padding: var(--ds-space-1) var(--ds-space-2);
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--ds-input-radius);
  border: 1px solid var(--vitta-divider, var(--f7-list-item-border-color, #e5e5ea));
  background: var(--vitta-surface, var(--f7-page-bg-color, #f2f2f7));
  color: var(--vitta-text, var(--f7-text-color, #333));
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.book-staff-btn--active {
  background: var(--vitta-text, var(--f7-theme-color, #7C6A5A));
  border-color: var(--vitta-text, var(--f7-theme-color, #7C6A5A));
  color: #fff;
}
.book-slot-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ds-space-1);
}
.book-slot-btn {
  padding: var(--ds-space-1) var(--ds-space-2);
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: var(--ds-input-radius);
  border: 1px solid var(--vitta-divider, var(--f7-list-item-border-color, #e5e5ea));
  background: var(--vitta-surface, var(--f7-page-bg-color, #f2f2f7));
  color: var(--vitta-text, var(--f7-text-color, #333));
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.book-slot-btn--active {
  background: var(--vitta-text, var(--f7-theme-color, #7C6A5A));
  border-color: var(--vitta-text, var(--f7-theme-color, #7C6A5A));
  color: #fff;
}
.book-back-link {
  margin: var(--ds-space-2) 0 0;
  font-size: 0.9375rem;
}
.book-back-link a {
  color: var(--vitta-text, var(--f7-theme-color, #7C6A5A));
  text-decoration: none;
}
.book-client-found {
  background: var(--vitta-accent, var(--f7-color-green, #B3C9B6));
  color: #fff;
  border-radius: var(--ds-input-radius);
  padding: var(--ds-space-2);
  margin: var(--ds-space-2) 0;
}
.book-client-found p {
  margin: 0;
  font-size: 0.9rem;
}
.book-no-email {
  background: rgba(217, 196, 180, 0.5);
  border-radius: var(--ds-input-radius);
  padding: var(--ds-space-2);
  margin: var(--ds-space-2) 0;
  border: 1px solid var(--vitta-divider, #E0D3C9);
}
.book-no-email p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--vitta-text, #333);
}
.book-success-card .v-section-title {
  color: var(--vitta-accent, #B3C9B6);
}
.book-success-datetime {
  margin: var(--ds-space-2) 0 0;
  font-size: var(--ds-font-body);
}
.ds-spacer {
  height: var(--ds-space-1);
}
:deep(.v-list-item__after) {
  color: var(--vitta-text, var(--f7-text-color, #333));
  opacity: 1;
}
</style>

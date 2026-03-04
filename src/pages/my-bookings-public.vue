<template>
  <f7-page class="public-my-bookings-page tenant-login">
    <f7-navbar :title="tenantName ? `Mis turnos · ${tenantName}` : 'Mis turnos'" />

    <f7-block v-if="checkingTenant" class="block-strong">
      <p>Cargando...</p>
    </f7-block>

    <template v-else>
      <f7-block strong inset>
        <p class="block-title">Consultar por DNI</p>
        <f7-list form>
          <f7-list-input
            label="DNI"
            type="text"
            inputmode="numeric"
            v-model:value="dni"
            placeholder="Ingresá tu DNI"
            clear-button
          />
        </f7-list>
        <f7-button fill large :disabled="searching || !dniTrimmed" @click="search">Buscar</f7-button>
      </f7-block>

      <f7-block v-if="searched && !searching" strong inset>
        <p v-if="!clientName && bookings.length === 0" class="text-color-gray">No encontramos turnos para ese DNI.</p>
        <p v-else-if="clientName && bookings.length === 0" class="text-color-gray">No tenés turnos próximos.</p>
        <template v-else>
          <p v-if="clientName" class="client-name">Hola, {{ clientName }}</p>
          <f7-list>
            <f7-list-item
              v-for="b in bookings"
              :key="b.id"
              class="booking-item"
              :title="`${b.date} · ${b.startTime} – ${b.endTime}`"
              after=""
            >
              <template #subtitle>
                <span v-if="b.staffName">{{ b.staffName }}</span>
                <span v-if="b.servicesSnapshot?.length"> · {{ serviceNames(b.servicesSnapshot) }}</span>
                <span v-if="b.totalDurationMinutes"> · {{ b.totalDurationMinutes }} min</span>
              </template>
              <template #after>
                <span class="status-badge" :class="b.status">{{ statusLabel(b.status) }}</span>
              </template>
            </f7-list-item>
          </f7-list>
        </template>
      </f7-block>

      <f7-block strong inset>
        <f7-link href="#" @click.prevent="goToBook">Reservar un turno</f7-link>
      </f7-block>
    </template>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getTenant } from '../tenant/tenantService';
import { getBookingsByDni, type BookingSummary } from '../services/publicBookingApi';

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const checkingTenant = ref(true);
const tenantName = ref('');
const dni = ref('');
const searching = ref(false);
const searched = ref(false);
const bookings = ref<BookingSummary[]>([]);
const clientName = ref<string | null>(null);

const dniTrimmed = computed(() => dni.value.trim().replace(/\D/g, '').length >= 7);

function serviceNames(snapshot: Array<{ name?: string }>): string {
  return (snapshot || []).map((s) => s.name ?? '').filter(Boolean).join(', ');
}
function statusLabel(s: string): string {
  const map: Record<string, string> = {
    confirmed: 'Confirmado',
    pending: 'Pendiente',
    completed: 'Completado',
    cancelled: 'Cancelado',
    no_show: 'No asistió',
  };
  return map[s] ?? s;
}

async function search(): Promise<void> {
  const tid = tenantId.value;
  const d = dni.value.trim().replace(/\D/g, '');
  if (!tid || d.length < 7) return;
  searching.value = true;
  searched.value = true;
  bookings.value = [];
  clientName.value = null;
  try {
    const result = await getBookingsByDni(tid, d);
    bookings.value = result.bookings ?? [];
    clientName.value = result.clientName ?? null;
  } catch (e) {
    console.error(e);
    bookings.value = [];
  } finally {
    searching.value = false;
  }
}

function goToBook(): void {
  router.push(`/t/${tenantId.value}/book/`);
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
  } catch (e) {
    router.push('/tenant-not-found/');
  } finally {
    checkingTenant.value = false;
  }
});
</script>

<style scoped>
.public-my-bookings-page .block-title {
  margin-bottom: 0.75rem;
  font-weight: 600;
}
.client-name {
  font-weight: 600;
  margin-bottom: 0.75rem;
}
.booking-item .status-badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--f7-color-gray);
  color: #fff;
}
.booking-item .status-badge.confirmed {
  background: var(--vitta-accent, #34c759);
}
.booking-item .status-badge.pending {
  background: #ff9500;
}
.booking-item .status-badge.completed {
  background: #007aff;
}
</style>

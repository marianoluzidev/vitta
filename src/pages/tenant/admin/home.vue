<template>
  <f7-page class="admin-page">
    <f7-navbar :title="`Resumen del día ${appConfig.version}`" />

    <f7-block v-if="logoUrl" class="tenant-logo-container">
      <img
        :src="logoUrl"
        :alt="`Logo de ${tenantName}`"
        class="tenant-logo"
        @error="onLogoError"
      />
    </f7-block>

    <f7-block strong inset>
      <p class="block-title">Turnos de hoy</p>
    </f7-block>
    <f7-block v-if="loadingBookings" class="block-strong">
      <p>Cargando...</p>
    </f7-block>
    <f7-list v-else-if="todayBookings.length > 0" strong inset>
      <f7-list-item
        v-for="b in todayBookings"
        :key="b.id"
        class="admin-home-booking-item"
        link
        :href="bookingDetailUrl(b.id)"
        @click.prevent="goToBookingDetail(b.id)"
      >
        <template #default>
          <div class="admin-home-booking">
            <div class="admin-home-booking-header">
              <span class="admin-home-booking-time">{{ b.startTime }} – {{ b.endTime }}</span>
              <span v-if="b.status !== 'confirmed'" class="badge color-orange">{{ b.status }}</span>
            </div>
            <div class="admin-home-booking-row">
              <span class="admin-home-booking-label">Staff:</span>
              <span>{{ b.staffName || '—' }}</span>
            </div>
            <div class="admin-home-booking-row">
              <span class="admin-home-booking-label">Cliente:</span>
              <span>{{ customerLabel(b.customer) || '—' }}</span>
            </div>
          </div>
        </template>
      </f7-list-item>
    </f7-list>
    <f7-block v-else class="block-strong">
      <p>No hay turnos para hoy.</p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';
import { getTenant } from '../../../tenant/tenantService';
import { appConfig } from '../../../config.js';

interface CustomerSnap {
  firstName?: string;
  lastName?: string;
}
interface BookingItem {
  id: string;
  startTime: string;
  endTime: string;
  staffName: string;
  status: string;
  customer?: CustomerSnap;
}

const route = useRoute();
const router = useRouter();
const tenantId = (route.params.tenantId as string) ?? '';
const tenantName = ref('Tenant');
const logoError = ref(false);
const todayBookings = ref<BookingItem[]>([]);
const loadingBookings = ref(false);

const todayStr = computed(() => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
});

function customerLabel(c?: CustomerSnap): string {
  if (!c) return '';
  return [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sin nombre';
}

function bookingDetailUrl(bookingId: string): string {
  return `/t/${tenantId}/admin/agenda/booking/${bookingId}/`;
}

function goToBookingDetail(bookingId: string): void {
  router.push(bookingDetailUrl(bookingId));
}

const logoUrl = computed(() => {
  if (!tenantId || logoError.value) return null;
  return `/branding/${tenantId}/logo.png`;
});

function onLogoError() {
  logoError.value = true;
}

function loadTodayBookings() {
  if (!tenantId) return;
  loadingBookings.value = true;
  const db = getDbInstance();
  const q = query(
    collection(db, 'tenants', tenantId, 'bookings'),
    where('date', '==', todayStr.value),
    orderBy('startTime', 'asc')
  );
  getDocs(q)
    .then((snap) => {
      todayBookings.value = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          startTime: d.startTime ?? '',
          endTime: d.endTime ?? '',
          staffName: d.staffName ?? '',
          status: d.status ?? '',
          customer: d.customer,
        };
      });
    })
    .catch((err) => {
      console.error('Error loading today bookings:', err);
      todayBookings.value = [];
    })
    .finally(() => {
      loadingBookings.value = false;
    });
}

onMounted(async () => {
  if (tenantId) {
    try {
      const tenant = await getTenant(tenantId);
      if (tenant) tenantName.value = tenant.name || tenantId;
      logoError.value = false;
    } catch {
      logoError.value = true;
    }
    loadTodayBookings();
  }
});
</script>

<style scoped>
.admin-home-booking-item {
  align-items: flex-start;
}
.admin-home-booking {
  width: 100%;
  padding: 0.25rem 0;
}
.admin-home-booking-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.admin-home-booking-time {
  font-weight: 600;
  font-size: 1rem;
}
.admin-home-booking-row {
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
  color: var(--f7-block-title-color, #6d6d72);
}
.admin-home-booking-label {
  font-weight: 500;
  display: inline-block;
  min-width: 4.5rem;
}
</style>

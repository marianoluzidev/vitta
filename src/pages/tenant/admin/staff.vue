<template>
  <f7-page class="admin-page">
    <f7-navbar title="Staff">
      <f7-nav-right>
        <f7-link @click="goToNew">Nuevo</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <f7-block v-if="loading" class="block-strong">
      <p>Cargando...</p>
    </f7-block>

    <f7-list v-else-if="staffList.length > 0" strong inset>
      <f7-list-item
        v-for="member in staffList"
        :key="member.id"
        :title="fullName(member)"
        link
        @click.prevent="goToEdit(member.id)"
      >
        <template #after>
          <span v-if="!member.active" class="badge color-red" style="margin-right: 0.5rem;">Inactivo</span>
          <span>{{ roleLabel(member.role) }}</span>
        </template>
      </f7-list-item>
    </f7-list>

    <f7-block v-else class="block-strong">
      <p>No hay staff. Usa Nuevo para agregar.</p>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { collection, onSnapshot } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';

export interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: 'owner' | 'admin' | 'staff';
  active: boolean;
  phone: string;
  email: string;
  serviceIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const staffList = ref<StaffMember[]>([]);
const loading = ref(true);
let unsubscribe: (() => void) | null = null;

function fullName(member: StaffMember): string {
  return [member.firstName, member.lastName].filter(Boolean).join(' ') || 'Sin nombre';
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    owner: 'Dueño',
    admin: 'Admin',
    staff: 'Staff',
  };
  return labels[role] ?? role;
}

function goToNew(): void {
  router.push(`/t/${tenantId.value}/admin/staff/new/`);
}

function goToEdit(staffId: string): void {
  router.push(`/t/${tenantId.value}/admin/staff/${staffId}/`);
}

onMounted(() => {
  const tid = tenantId.value;
  if (!tid) {
    loading.value = false;
    return;
  }
  const db = getDbInstance();
  const staffRef = collection(db, 'tenants', tid, 'staff');
  unsubscribe = onSnapshot(
    staffRef,
    (snapshot) => {
      staffList.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as StaffMember[];
      loading.value = false;
    },
    (err) => {
      console.error('Staff onSnapshot error:', err);
      loading.value = false;
    }
  );
});

onBeforeUnmount(() => {
  if (unsubscribe) unsubscribe();
});
</script>

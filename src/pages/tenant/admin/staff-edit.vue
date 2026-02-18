<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar title="Editar staff" back-link="Atrás" :back-link-url="staffListUrl">
      <f7-nav-right>
        <f7-link @click="goToStaffList">Cancelar</f7-link>
        <f7-link @click="handleSave" :disabled="saving">Guardar</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <f7-block v-if="loading" class="block-strong">
      <p>Cargando...</p>
    </f7-block>

    <f7-block v-else strong inset>
      <f7-list form>
        <f7-list-input
          label="Nombre"
          type="text"
          placeholder="Ej. Juan"
          v-model:value="form.firstName"
          clear-button
        />
        <f7-list-input
          label="Apellido"
          type="text"
          placeholder="Ej. Pérez"
          v-model:value="form.lastName"
          clear-button
        />
        <f7-list-item title="Rol" smart-select :smart-select-params="{ openIn: 'page' }">
          <select name="role" v-model="form.role">
            <option value="owner">Dueño</option>
            <option value="admin">Admin</option>
            <option value="staff">Staff</option>
          </select>
        </f7-list-item>
        <f7-list-input
          label="Teléfono"
          type="tel"
          placeholder="Ej. +54 11 1234-5678"
          v-model:value="form.phone"
          clear-button
        />
        <f7-list-input
          label="Email"
          type="email"
          placeholder="ejemplo@email.com"
          v-model:value="form.email"
          clear-button
        />
        <f7-list-item title="Activo">
          <template #after>
            <f7-toggle v-model:checked="form.active" />
          </template>
        </f7-list-item>
      </f7-list>
      <f7-list v-if="servicesList.length > 0">
        <f7-list-item title="Servicios que brinda" group-title />
        <f7-list-item
          v-for="service in servicesList"
          :key="service.id"
          :title="service.name"
          checkbox
          :checked="form.serviceIds.includes(service.id)"
          @change="toggleService(service.id)"
        />
      </f7-list>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { reactive, computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { doc, getDoc, getDocs, updateDoc, serverTimestamp, collection } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';

interface ServiceItem {
  id: string;
  name: string;
}

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const staffId = computed(() => (route.params.staffId as string) ?? '');
const staffListUrl = computed(() => `/t/${tenantId.value}/?tab=staff`);
const loading = ref(true);
const saving = ref(false);
const servicesList = ref<ServiceItem[]>([]);

function goToStaffList(): void {
  router.push(staffListUrl.value);
}

const form = reactive({
  firstName: '',
  lastName: '',
  role: 'staff' as 'owner' | 'admin' | 'staff',
  phone: '',
  email: '',
  active: true,
  serviceIds: [] as string[],
});

function toggleService(serviceId: string): void {
  const idx = form.serviceIds.indexOf(serviceId);
  if (idx === -1) {
    form.serviceIds.push(serviceId);
  } else {
    form.serviceIds.splice(idx, 1);
  }
}

onMounted(async () => {
  const tid = tenantId.value;
  const sid = staffId.value;
  if (!tid || !sid) {
    loading.value = false;
    return;
  }
  const db = getDbInstance();
  try {
    const [staffSnap, servicesSnap] = await Promise.all([
      getDoc(doc(db, 'tenants', tid, 'staff', sid)),
      getDocs(collection(db, 'tenants', tid, 'services')),
    ]);
    if (!staffSnap.exists()) {
      goToStaffList();
      return;
    }
    const d = staffSnap.data();
    form.firstName = d.firstName ?? '';
    form.lastName = d.lastName ?? '';
    form.role = (d.role as 'owner' | 'admin' | 'staff') ?? 'staff';
    form.phone = d.phone ?? '';
    form.email = d.email ?? '';
    form.active = d.active ?? true;
    form.serviceIds = Array.isArray(d.serviceIds) ? [...d.serviceIds] : [];
    servicesList.value = servicesSnap.docs.map((doc) => ({ id: doc.id, name: doc.data().name ?? '' }));
  } catch (err) {
    console.error('Error loading staff:', err);
    goToStaffList();
  } finally {
    loading.value = false;
  }
});

async function handleSave(): Promise<void> {
  const tid = tenantId.value;
  const sid = staffId.value;
  if (!tid || !sid) return;
  if (saving.value) return;
  saving.value = true;
  try {
    const db = getDbInstance();
    const staffRef = doc(db, 'tenants', tid, 'staff', sid);
    await updateDoc(staffRef, {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      role: form.role,
      active: form.active,
      phone: form.phone.trim(),
      email: form.email.trim(),
      serviceIds: form.serviceIds,
      updatedAt: serverTimestamp(),
    });
    router.push(`/t/${tid}/?tab=staff`);
  } catch (err) {
    console.error('Error updating staff:', err);
    saving.value = false;
  }
}
</script>

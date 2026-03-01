<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar title="Editar Servicio" back-link="Atrás" :back-link-url="servicesListUrl">
      <f7-nav-right>
        <f7-link @click="goToServicesList">Cancelar</f7-link>
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
          placeholder="Ej. Corte de pelo"
          v-model:value="form.name"
          clear-button
        />
        <f7-list-input
          label="Descripción"
          type="textarea"
          placeholder="Descripción del servicio"
          v-model:value="form.description"
          clear-button
        />
        <f7-list-input
          label="Precio (ARS)"
          type="number"
          placeholder="0"
          v-model:value="form.price"
          clear-button
        />
        <f7-list-input
          label="Duración (minutos)"
          type="number"
          placeholder="30"
          v-model:value="form.durationMinutes"
          clear-button
        />
        <f7-list-item title="Activo">
          <template #after>
            <f7-toggle v-model:checked="form.active" />
          </template>
        </f7-list-item>
      </f7-list>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { reactive, computed, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const serviceId = computed(() => (route.params.serviceId as string) ?? '');
const servicesListUrl = computed(() => `/t/${tenantId.value}/admin/services/`);
const loading = ref(true);
const saving = ref(false);

function goToServicesList(): void {
  router.push(servicesListUrl.value);
}

const form = reactive({
  name: '',
  description: '',
  price: '',
  durationMinutes: '',
  active: true,
});

onMounted(async () => {
  const tid = tenantId.value;
  const sid = serviceId.value;
  if (!tid || !sid) {
    loading.value = false;
    return;
  }
  try {
    const db = getDbInstance();
    const serviceDoc = await getDoc(doc(db, 'tenants', tid, 'services', sid));
    if (!serviceDoc.exists()) {
      goToServicesList();
      return;
    }
    const d = serviceDoc.data();
    form.name = d.name ?? '';
    form.description = d.description ?? '';
    form.price = d.price != null ? String(d.price) : '';
    form.durationMinutes = d.durationMinutes != null ? String(d.durationMinutes) : '';
    form.active = d.active ?? true;
  } catch (err) {
    console.error('Error loading service:', err);
    goToServicesList();
  } finally {
    loading.value = false;
  }
});

async function handleSave(): Promise<void> {
  const tid = tenantId.value;
  const sid = serviceId.value;
  if (!tid || !sid) return;
  if (saving.value) return;

  const name = String(form.name).trim();
  const price = Number(form.price);
  const durationMinutes = Number(form.durationMinutes);

  if (!name) return;
  if (Number.isNaN(price) || price < 0) return;
  if (Number.isNaN(durationMinutes) || durationMinutes <= 0) return;

  saving.value = true;
  try {
    const db = getDbInstance();
    const serviceRef = doc(db, 'tenants', tid, 'services', sid);
    await updateDoc(serviceRef, {
      name,
      description: String(form.description).trim(),
      price,
      durationMinutes,
      active: form.active,
      updatedAt: serverTimestamp(),
    });
    router.push(`/t/${tid}/admin/services/`);
  } catch (err) {
    console.error('Error updating service:', err);
    saving.value = false;
  }
}
</script>

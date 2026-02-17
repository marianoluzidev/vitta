<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar title="Nuevo Servicio" back-link="Atrás" :back-link-url="servicesListUrl">
      <f7-nav-right>
        <f7-link @click="handleSave" :disabled="saving">Guardar</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <f7-block strong inset>
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
import { reactive, computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const servicesListUrl = computed(() => `/t/${tenantId.value}/?tab=services`);
const saving = ref(false);

const form = reactive({
  name: '',
  description: '',
  price: '',
  durationMinutes: '',
  active: true,
});

async function handleSave(): Promise<void> {
  const tid = tenantId.value;
  if (!tid) return;
  if (saving.value) return;

  const name = String(form.name).trim();
  const price = Number(form.price);
  const durationMinutes = Number(form.durationMinutes);

  if (!name) {
    return;
  }
  if (Number.isNaN(price) || price < 0) {
    return;
  }
  if (Number.isNaN(durationMinutes) || durationMinutes <= 0) {
    return;
  }

  saving.value = true;
  try {
    const db = getDbInstance();
    const servicesRef = collection(db, 'tenants', tid, 'services');
    await addDoc(servicesRef, {
      name,
      description: String(form.description).trim(),
      price,
      durationMinutes,
      active: form.active,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    router.back();
  } catch (err) {
    console.error('Error creating service:', err);
    saving.value = false;
  }
}
</script>

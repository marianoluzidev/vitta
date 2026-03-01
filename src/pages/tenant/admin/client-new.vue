<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar title="Nuevo cliente" back-link="Atrás" :back-link-url="clientsListUrl">
      <f7-nav-right>
        <f7-link @click="handleSave" :disabled="saving || !canSave">Guardar</f7-link>
      </f7-nav-right>
    </f7-navbar>

    <f7-block v-if="errorMessage" strong inset class="client-new-error-block">
      <p class="client-new-error">{{ errorMessage }}</p>
    </f7-block>

    <f7-block strong inset>
      <f7-list form>
        <f7-list-input
          label="Nombre"
          type="text"
          placeholder="Ej. Juan"
          v-model:value="form.firstName"
          clear-button
          :disabled="saving"
        />
        <f7-list-input
          label="Apellido"
          type="text"
          placeholder="Ej. Pérez"
          v-model:value="form.lastName"
          clear-button
          :disabled="saving"
        />
        <f7-list-input
          label="DNI"
          type="text"
          placeholder="Ej. 12345678"
          v-model:value="form.dni"
          clear-button
          :disabled="saving"
        />
        <f7-list-input
          label="Teléfono"
          type="tel"
          placeholder="Ej. +54 11 1234-5678"
          v-model:value="form.phone"
          clear-button
          :disabled="saving"
        />
        <f7-list-input
          label="Email"
          type="email"
          placeholder="ejemplo@email.com"
          v-model:value="form.email"
          clear-button
          :disabled="saving"
        />
        <f7-list-input
          label="Notas"
          type="textarea"
          placeholder="Notas internas"
          v-model:value="form.notes"
          clear-button
          :disabled="saving"
        />
      </f7-list>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';
import { f7ready } from 'framework7-vue';

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const clientsListUrl = computed(() => `/t/${tenantId.value}/?tab=clientes`);
const saving = ref(false);
const errorMessage = ref('');

const form = reactive({
  firstName: '',
  lastName: '',
  dni: '',
  phone: '',
  email: '',
  notes: '',
});

const canSave = computed(() => {
  const first = form.firstName.trim();
  const last = form.lastName.trim();
  return first.length > 0 || last.length > 0;
});

function showToast(text: string, isError = false): void {
  f7ready((f7) => {
    f7.toast?.show?.({ text, closeTimeout: 2500, cssClass: isError ? 'toast-error' : '' });
  });
}

async function handleSave(): Promise<void> {
  const tid = tenantId.value;
  if (!tid || saving.value || !canSave.value) return;

  errorMessage.value = '';
  saving.value = true;
  try {
    const db = getDbInstance();
    const ref = collection(db, 'tenants', tid, 'clients');
    await addDoc(ref, {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      dni: form.dni.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      notes: form.notes.trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    showToast('Cliente creado');
    router.push(`/t/${tid}/?tab=clientes`);
  } catch (e) {
    console.error('Error creating client:', e);
    errorMessage.value = 'No se pudo crear el cliente. Intentá de nuevo.';
    showToast('Error al crear', true);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.client-new-error-block {
  margin-bottom: 0;
}
.client-new-error {
  margin: 0;
  color: var(--f7-color-red);
  font-size: 0.95rem;
}
</style>

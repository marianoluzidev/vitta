<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar title="Nuevo cliente" back-link="Atrás" :back-link-url="clientsListUrl">
      <f7-nav-right>
        <f7-link
          :class="{ 'disabled': saving || !canSave }"
          @click="onNavSave"
        >
          {{ saving ? 'Guardando...' : 'Guardar' }}
        </f7-link>
      </f7-nav-right>
    </f7-navbar>

    <div class="ds-page-content">
      <VCard v-if="errorMessage" error>
        <p class="ds-error-text">{{ errorMessage }}</p>
      </VCard>

      <VCard>
        <VFormField label="Nombre">
          <input
            v-model="form.firstName"
            type="text"
            placeholder="Ej. Juan"
            class="ds-input"
            :disabled="saving"
          />
        </VFormField>
        <VFormField label="Apellido">
          <input
            v-model="form.lastName"
            type="text"
            placeholder="Ej. Pérez"
            class="ds-input"
            :disabled="saving"
          />
        </VFormField>
        <VFormField label="DNI (opcional)">
          <input
            v-model="form.dni"
            type="text"
            placeholder="Ej. 12345678"
            class="ds-input"
            :disabled="saving"
          />
        </VFormField>
        <VFormField label="Teléfono">
          <input
            v-model="form.phone"
            type="tel"
            placeholder="Ej. +54 11 1234-5678"
            class="ds-input"
            :disabled="saving"
          />
        </VFormField>
        <VFormField label="Email">
          <input
            v-model="form.email"
            type="email"
            placeholder="ejemplo@email.com"
            class="ds-input"
            :disabled="saving"
          />
        </VFormField>
        <VFormField label="Notas">
          <textarea
            v-model="form.notes"
            placeholder="Notas internas"
            class="ds-textarea"
            rows="3"
            :disabled="saving"
          />
        </VFormField>
      </VCard>

      <div class="ds-spacer" />
    </div>
  </f7-page>
</template>

<script setup lang="ts">
import { reactive, computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';
import { f7ready } from 'framework7-vue';
import VCard from '../../../components/ui/VCard.vue';
import VFormField from '../../../components/ui/VFormField.vue';

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

function onNavSave(): void {
  if (!saving.value && canSave.value) handleSave();
}

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
.ds-page-content {
  padding: var(--ds-space-2) var(--ds-space-2) 100px;
}
.ds-error-text {
  margin: 0;
  color: var(--f7-color-red);
  font-size: var(--ds-font-title);
  font-weight: 500;
}
.ds-input {
  width: 100%;
  font-size: var(--ds-font-body);
  padding: var(--ds-space-1) var(--ds-space-2);
  border-radius: var(--ds-input-radius);
  border: 1px solid var(--f7-list-item-border-color, #e5e5ea);
  background: var(--f7-page-bg-color, #f2f2f7);
  color: var(--f7-text-color, #000);
  box-sizing: border-box;
}
.ds-textarea {
  width: 100%;
  font-size: var(--ds-font-body);
  padding: var(--ds-space-2);
  border-radius: var(--ds-input-radius);
  border: 1px solid var(--f7-list-item-border-color, #e5e5ea);
  background: var(--f7-page-bg-color, #f2f2f7);
  color: var(--f7-text-color, #000);
  resize: vertical;
  min-height: 72px;
  box-sizing: border-box;
}
.ds-spacer {
  height: var(--ds-space-1);
}
.navbar .link.disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>

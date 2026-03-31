<template>
  <f7-page class="admin-page tenant-login">
    <f7-navbar title="Editar cliente" back-link="Atrás" :back-link-url="clientViewUrl">
      <f7-nav-right>
        <f7-link
          :class="{ 'disabled': saving || !hasChanges }"
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

      <VCard v-if="loading">
        <p class="ds-muted">Cargando...</p>
      </VCard>

      <VCard v-else-if="clientLoaded">
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

      <VCard v-else-if="!loading">
        <p class="ds-muted">No se encontró el cliente.</p>
      </VCard>

      <div class="ds-spacer" />
    </div>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDbInstance } from '../../../firebase/firebase';
import { f7ready } from 'framework7-vue';
import VCard from '../../../components/ui/VCard.vue';
import VFormField from '../../../components/ui/VFormField.vue';

const route = useRoute();
const router = useRouter();
const tenantId = computed(() => (route.params.tenantId as string) ?? '');
const clientId = computed(() => (route.params.clientId as string) ?? '');
const clientViewUrl = computed(() => `/t/${tenantId.value}/admin/clientes/${clientId.value}/`);

const loading = ref(true);
const saving = ref(false);
const clientLoaded = ref(false);
const errorMessage = ref('');

const form = reactive({
  firstName: '',
  lastName: '',
  dni: '',
  phone: '',
  email: '',
  notes: '',
});

const initialSnapshot = reactive({
  firstName: '',
  lastName: '',
  dni: '',
  phone: '',
  email: '',
  notes: '',
});

const hasChanges = computed(() => {
  return (
    form.firstName !== initialSnapshot.firstName ||
    form.lastName !== initialSnapshot.lastName ||
    form.dni !== initialSnapshot.dni ||
    form.phone !== initialSnapshot.phone ||
    form.email !== initialSnapshot.email ||
    form.notes !== initialSnapshot.notes
  );
});

function onNavSave(): void {
  if (!saving.value && hasChanges.value) handleSave();
}

function setError(msg: string): void {
  errorMessage.value = msg;
}

function showToast(text: string, isError = false): void {
  f7ready((f7) => {
    f7.toast?.show?.({ text, closeTimeout: 2500, cssClass: isError ? 'toast-error' : '' });
  });
}

function loadClient(): void {
  const tid = tenantId.value;
  const cid = clientId.value;
  if (!tid || !cid) {
    loading.value = false;
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  const db = getDbInstance();
  getDoc(doc(db, 'tenants', tid, 'clients', cid))
    .then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const first = (d.firstName ?? '').trim();
        const last = (d.lastName ?? '').trim();
        const dni = (d.dni ?? '').trim();
        const phone = (d.phone ?? '').trim();
        const email = (d.email ?? '').trim();
        const notes = (d.notes ?? '').trim();
        form.firstName = first;
        form.lastName = last;
        form.dni = dni;
        form.phone = phone;
        form.email = email;
        form.notes = notes;
        initialSnapshot.firstName = first;
        initialSnapshot.lastName = last;
        initialSnapshot.dni = dni;
        initialSnapshot.phone = phone;
        initialSnapshot.email = email;
        initialSnapshot.notes = notes;
        clientLoaded.value = true;
      } else {
        clientLoaded.value = false;
      }
    })
    .catch((err) => {
      console.error('Error loading client:', err);
      setError('Error al cargar el cliente.');
      clientLoaded.value = false;
    })
    .finally(() => {
      loading.value = false;
    });
}

function validate(): boolean {
  const first = form.firstName.trim();
  const last = form.lastName.trim();
  if (!first && !last) {
    setError('Ingresá al menos nombre o apellido.');
    return false;
  }
  errorMessage.value = '';
  return true;
}

async function handleSave(): Promise<void> {
  if (saving.value || !clientLoaded.value || !hasChanges.value) return;
  if (!validate()) return;
  saving.value = true;
  errorMessage.value = '';
  const tid = tenantId.value;
  const cid = clientId.value;
  if (!tid || !cid) {
    saving.value = false;
    return;
  }
  try {
    const db = getDbInstance();
    const ref = doc(db, 'tenants', tid, 'clients', cid);
    await updateDoc(ref, {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      dni: form.dni.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      notes: form.notes.trim(),
      updatedAt: serverTimestamp(),
    });
    initialSnapshot.firstName = form.firstName.trim();
    initialSnapshot.lastName = form.lastName.trim();
    initialSnapshot.dni = form.dni.trim();
    initialSnapshot.phone = form.phone.trim();
    initialSnapshot.email = form.email.trim();
    initialSnapshot.notes = form.notes.trim();
    showToast('Cambios guardados');
    router.go(-1);
  } catch (e) {
    console.error('Error saving client:', e);
    setError('No se pudieron guardar los cambios. Intentá de nuevo.');
    showToast('Error al guardar', true);
  } finally {
    saving.value = false;
  }
}

onBeforeRouteLeave((_to, _from, next) => {
  if (!hasChanges.value) {
    next();
    return;
  }
  const leave = window.confirm('Hay cambios sin guardar. ¿Salir igual?');
  if (leave) next();
  else next(false);
});

onMounted(loadClient);
watch([tenantId, clientId], loadClient);
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
.ds-muted {
  margin: 0;
  font-size: 0.9375rem;
  color: var(--f7-block-strong-text-color, #8e8e93);
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

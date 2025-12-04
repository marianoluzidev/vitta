<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/clients"></IonBackButton>
        </IonButtons>
        <IonTitle>Nuevo cliente</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <div class="form-container">
        <form @submit.prevent="handleSubmit" class="client-form">
          <IonItem>
            <IonLabel position="stacked">Nombre completo *</IonLabel>
            <IonInput
              v-model="name"
              type="text"
              placeholder="María González"
              required
              :disabled="loading"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Teléfono *</IonLabel>
            <IonInput
              v-model="phone"
              type="tel"
              placeholder="+54 11 1234-5678"
              required
              :disabled="loading"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Email</IonLabel>
            <IonInput
              v-model="email"
              type="email"
              placeholder="maria@email.com"
              :disabled="loading"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Notas</IonLabel>
            <IonTextarea
              v-model="notes"
              placeholder="Información adicional sobre el cliente..."
              rows="4"
              :disabled="loading"
            />
          </IonItem>

          <IonButton
            expand="block"
            type="submit"
            class="submit-button"
            :disabled="loading || !canSubmit"
          >
            <IonSpinner v-if="loading" name="crescent" />
            <span v-else>Crear cliente</span>
          </IonButton>

          <div v-if="error" class="error-message">
            <IonText color="danger">{{ error }}</IonText>
          </div>
        </form>
      </div>
    </IonContent>
  </IonPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonButton,
  IonSpinner,
  IonText,
} from '@ionic/vue';
import { auth, db } from '@/firebase/app';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { createClient, type CreateClientPayload } from '@/services/clientsService';
import { navigateToTab } from '@/utils/navigation';

const router = useRouter();

const name = ref('');
const phone = ref('');
const email = ref('');
const notes = ref('');
const loading = ref(false);
const error = ref('');
const salonId = ref('');

const canSubmit = computed(() => {
  return name.value.trim() && phone.value.trim();
});

async function loadSalonId(): Promise<string | null> {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        resolve(null);
        return;
      }

      try {
        const salonsRef = collection(db, 'salons');
        const q = query(salonsRef, where('ownerId', '==', user.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const salonDoc = querySnapshot.docs[0];
          resolve(salonDoc.id);
        } else {
          resolve(null);
        }
      } catch (err) {
        console.error('Error loading salon:', err);
        resolve(null);
      }
    });
  });
}

onMounted(async () => {
  const id = await loadSalonId();
  if (!id) {
    error.value = 'No se encontró el salón. Por favor inicia sesión nuevamente.';
    router.push('/onboarding');
    return;
  }
  salonId.value = id;
});

async function handleSubmit() {
  if (!canSubmit.value) {
    error.value = 'Por favor completa los campos obligatorios';
    return;
  }

  if (!salonId.value) {
    error.value = 'Error: No se encontró el salón';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const payload: CreateClientPayload = {
      salonId: salonId.value,
      name: name.value.trim(),
      phone: phone.value.trim(),
      email: email.value.trim() || undefined,
      notes: notes.value.trim() || undefined,
    };

    await createClient(payload);
    navigateToTab('/tabs/clients');
  } catch (err: any) {
    console.error('Error creating client:', err);
    if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
      error.value = 'Error de permisos. Verifica las reglas de Firestore.';
    } else {
      error.value = err.message || 'Error al crear el cliente. Intenta nuevamente.';
    }
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.form-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100%;
  padding: 32px;
}

.client-form {
  width: 100%;
  max-width: 400px;
}

ion-item {
  margin-bottom: 16px;
  --border-radius: 8px;
}

.submit-button {
  margin-top: 24px;
  --border-radius: 8px;
  --padding-top: 16px;
  --padding-bottom: 16px;
  height: 48px;
  font-weight: 600;
  --background: #08b8a4;
  --background-activated: #06a894;
}

.error-message {
  margin-top: 16px;
  text-align: center;
  padding: 12px;
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  border-radius: 8px;
}
</style>


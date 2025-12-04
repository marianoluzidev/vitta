<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/services"></IonBackButton>
        </IonButtons>
        <IonTitle>Nuevo servicio</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <div class="form-container">
        <form @submit.prevent="handleSubmit" class="service-form">
          <IonItem>
            <IonLabel position="stacked">Nombre del servicio *</IonLabel>
            <IonInput
              v-model="name"
              type="text"
              placeholder="Corte y peinado"
              required
              :disabled="loading"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Duración (minutos) *</IonLabel>
            <IonInput
              v-model.number="duration"
              type="number"
              placeholder="45"
              min="1"
              required
              :disabled="loading"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Precio (ARS) *</IonLabel>
            <IonInput
              v-model.number="price"
              type="number"
              placeholder="3500"
              min="0"
              step="0.01"
              required
              :disabled="loading"
            />
          </IonItem>

          <IonButton
            expand="block"
            type="submit"
            class="submit-button"
            :disabled="loading"
          >
            <IonSpinner v-if="loading" name="crescent" />
            <span v-else>Crear servicio</span>
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
import { ref, onMounted } from 'vue';
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
  IonButton,
  IonSpinner,
  IonText,
} from '@ionic/vue';
import { auth, db } from '@/firebase/app';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { createService, type CreateServicePayload } from '@/services/servicesService';

const router = useRouter();

const name = ref('');
const duration = ref<number>(30);
const price = ref<number>(0);
const loading = ref(false);
const error = ref('');
const salonId = ref('');

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
  if (!name.value || !duration.value || !price.value) {
    error.value = 'Por favor completa todos los campos';
    return;
  }

  if (duration.value < 1) {
    error.value = 'La duración debe ser al menos 1 minuto';
    return;
  }

  if (price.value < 0) {
    error.value = 'El precio no puede ser negativo';
    return;
  }

  if (!salonId.value) {
    error.value = 'Error: No se encontró el salón';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const payload: CreateServicePayload = {
      salonId: salonId.value,
      name: name.value,
      duration: duration.value,
      price: price.value,
    };

    await createService(payload);
    router.push('/tabs/services');
  } catch (err: any) {
    console.error('Error creating service:', err);
    if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
      error.value = 'Error de permisos. Verifica las reglas de Firestore.';
    } else {
      error.value = err.message || 'Error al crear el servicio. Intenta nuevamente.';
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

.service-form {
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


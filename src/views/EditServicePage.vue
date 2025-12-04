<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonButton @click="goBack">
            <IonIcon :icon="arrowBack" slot="icon-only"></IonIcon>
          </IonButton>
        </IonButtons>
        <IonTitle>Editar servicio</IonTitle>
        <IonButtons slot="end">
          <IonButton @click="handleDelete" :disabled="loading || deleting" color="danger">
            <IonIcon :icon="trashOutline" slot="icon-only"></IonIcon>
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <!-- Loading State -->
      <div v-if="loadingService" class="loading-container">
        <IonSpinner name="crescent"></IonSpinner>
        <p>Cargando servicio...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="serviceError" class="error-container">
        <IonIcon :icon="alertCircleOutline" class="error-icon"></IonIcon>
        <h3>Error al cargar servicio</h3>
        <p>{{ serviceError }}</p>
        <IonButton @click="loadService">Reintentar</IonButton>
      </div>

      <!-- Edit Form -->
      <div v-else class="form-container">
        <form @submit.prevent="handleSubmit" class="service-form">
          <IonItem>
            <IonLabel position="stacked">Nombre del servicio *</IonLabel>
            <IonInput
              v-model="name"
              type="text"
              placeholder="Corte y peinado"
              required
              :disabled="loading || deleting"
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
              :disabled="loading || deleting"
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
              :disabled="loading || deleting"
            />
          </IonItem>

          <IonButton
            expand="block"
            type="submit"
            class="submit-button"
            :disabled="loading || deleting"
          >
            <IonSpinner v-if="loading" name="crescent" />
            <span v-else>Guardar cambios</span>
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
import { useRouter, useRoute } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonInput,
  IonSpinner,
  IonText,
  alertController,
} from '@ionic/vue';
import { trashOutline, alertCircleOutline, arrowBack } from 'ionicons/icons';
import { navigateToTab } from '@/utils/navigation';
import {
  getServiceById,
  updateService,
  deleteService,
  type Service,
} from '@/services/servicesService';

const router = useRouter();
const route = useRoute();

function goBack() {
  navigateToTab('/tabs/services');
}

const serviceId = ref<string>('');
const name = ref('');
const duration = ref<number>(30);
const price = ref<number>(0);
const loading = ref(false);
const loadingService = ref(true);
const deleting = ref(false);
const error = ref('');
const serviceError = ref('');

onMounted(() => {
  const id = route.params.id as string;
  if (!id) {
    serviceError.value = 'ID de servicio no válido';
    loadingService.value = false;
    return;
  }
  serviceId.value = id;
  loadService();
});

async function loadService() {
  loadingService.value = true;
  serviceError.value = '';

  try {
    const service = await getServiceById(serviceId.value);
    if (!service) {
      serviceError.value = 'Servicio no encontrado';
      return;
    }

    name.value = service.name;
    duration.value = service.duration;
    price.value = service.price;
  } catch (err: any) {
    console.error('Error loading service:', err);
    serviceError.value = err.message || 'Error al cargar el servicio';
  } finally {
    loadingService.value = false;
  }
}

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

  loading.value = true;
  error.value = '';

  try {
    await updateService(serviceId.value, {
      name: name.value,
      duration: duration.value,
      price: price.value,
    });

    navigateToTab('/tabs/services');
  } catch (err: any) {
    console.error('Error updating service:', err);
    if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
      error.value = 'Error de permisos. Verifica las reglas de Firestore.';
    } else {
      error.value = err.message || 'Error al actualizar el servicio. Intenta nuevamente.';
    }
  } finally {
    loading.value = false;
  }
}

async function handleDelete() {
  const alert = await alertController.create({
    header: 'Eliminar servicio',
    message: '¿Estás seguro de que deseas eliminar este servicio? Esta acción no se puede deshacer.',
    buttons: [
      {
        text: 'Cancelar',
        role: 'cancel',
      },
      {
        text: 'Eliminar',
        role: 'destructive',
        handler: async () => {
          deleting.value = true;
          error.value = '';

          try {
            await deleteService(serviceId.value);
            navigateToTab('/tabs/services');
          } catch (err: any) {
            console.error('Error deleting service:', err);
            deleting.value = false;
            if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
              error.value = 'Error de permisos. Verifica las reglas de Firestore.';
            } else {
              error.value = err.message || 'Error al eliminar el servicio. Intenta nuevamente.';
            }
          }
        },
      },
    ],
  });

  await alert.present();
}
</script>

<style scoped>
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
}

.loading-container p {
  margin-top: 16px;
  color: #6a6a6a;
}

.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
}

.error-icon {
  font-size: 64px;
  color: var(--ion-color-danger);
  margin-bottom: 16px;
}

.error-container h3 {
  margin: 0 0 8px 0;
  color: #222222;
}

.error-container p {
  margin: 0 0 24px 0;
  color: #6a6a6a;
}

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


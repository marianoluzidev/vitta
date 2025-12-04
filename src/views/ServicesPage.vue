<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Servicios</IonTitle>
        <IonButtons slot="end">
          <IonButton @click="goToNewService" :disabled="loading">
            <IonIcon :icon="add" slot="icon-only"></IonIcon>
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <!-- Loading State -->
      <div v-if="loading" class="loading-container">
        <IonSpinner name="crescent"></IonSpinner>
        <p>Cargando servicios...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-container">
        <IonIcon :icon="alertCircleOutline" class="error-icon"></IonIcon>
        <h3>Error al cargar servicios</h3>
        <p>{{ error }}</p>
        <IonButton @click="loadServices">Reintentar</IonButton>
      </div>

      <!-- Services List -->
      <div v-else-if="services.length > 0" class="services-container">
        <IonList>
          <IonItem
            v-for="service in services"
            :key="service.id"
            class="service-item"
            lines="full"
            button
            @click="goToEditService(service.id)"
          >
            <div class="service-content">
              <div class="service-main">
                <h3 class="service-name">{{ service.name }}</h3>
                <div class="service-details">
                  <span class="service-duration">{{ formatDuration(service.duration) }}</span>
                  <span class="service-price">{{ formatPrice(service.price) }}</span>
                </div>
              </div>
            </div>
          </IonItem>
        </IonList>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <IonIcon :icon="cutOutline" class="empty-icon"></IonIcon>
        <h3 class="empty-title">No hay servicios</h3>
        <p class="empty-subtitle">Toca el botón + para agregar un nuevo servicio.</p>
        <IonButton @click="goToNewService" class="add-button">
          Agregar servicio
        </IonButton>
      </div>
    </IonContent>
  </IonPage>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonBackButton,
  IonIcon,
  IonList,
  IonItem,
  IonSpinner,
} from '@ionic/vue';
import { add, alertCircleOutline, cutOutline } from 'ionicons/icons';
import { auth, db } from '@/firebase/app';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getServicesBySalonId, type Service } from '@/services/servicesService';

const router = useRouter();
const route = useRoute();

const services = ref<Service[]>([]);
const loading = ref(true);
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

async function loadServices() {
  loading.value = true;
  error.value = '';

  try {
    if (!salonId.value) {
      const id = await loadSalonId();
      if (!id) {
        error.value = 'No se encontró el salón. Por favor inicia sesión nuevamente.';
        loading.value = false;
        return;
      }
      salonId.value = id;
    }

    services.value = await getServicesBySalonId(salonId.value);
  } catch (err: any) {
    console.error('Error loading services:', err);
    error.value = err.message || 'Error al cargar los servicios';
  } finally {
    loading.value = false;
  }
}

function goToNewService() {
  router.push('/services/new');
}

function goToEditService(serviceId: string) {
  router.push(`/services/${serviceId}/edit`);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }
  return `${hours}h ${mins}min`;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
  }).format(price);
}

onMounted(() => {
  loadServices();
});

// Recargar servicios cuando se vuelve a esta ruta (desde editar/crear)
watch(
  () => route.name,
  (newName, oldName) => {
    if (newName === 'Services' && oldName && (oldName === 'EditService' || oldName === 'NewService')) {
      loadServices();
    }
  }
);
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

.services-container {
  padding: 16px;
}

.service-item {
  --padding-start: 0;
  --inner-padding-end: 0;
  margin-bottom: 12px;
  border-radius: 8px;
  background: var(--ion-item-background);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.service-content {
  width: 100%;
  padding: 16px;
}

.service-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.service-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #222222;
}

.service-details {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 0.875rem;
}

.service-duration {
  color: #6a6a6a;
}

.service-price {
  color: #08b8a4;
  font-weight: 600;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
}

.empty-icon {
  font-size: 64px;
  color: #6a6a6a;
  margin-bottom: 24px;
}

.empty-title {
  margin: 0 0 8px 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #222222;
}

.empty-subtitle {
  margin: 0 0 24px 0;
  font-size: 0.875rem;
  color: #6a6a6a;
}

.add-button {
  --background: #08b8a4;
  --background-activated: #06a894;
}
</style>


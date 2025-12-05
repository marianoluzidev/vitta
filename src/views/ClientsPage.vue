<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <IonPage @ionViewWillEnter="onViewWillEnter">
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
        <IonButtons slot="start">
          <IonMenuButton menu="main-menu"></IonMenuButton>
        </IonButtons>
        <IonTitle>Clientes</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
        <IonButtons slot="end">
          <IonButton @click="goToNewClient" :disabled="loading">
            <IonIcon :icon="add" slot="icon-only"></IonIcon>
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <!-- Loading State -->
      <div v-if="loading" class="loading-container">
        <IonSpinner name="crescent"></IonSpinner>
        <p>Cargando clientes...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-container">
        <IonIcon :icon="alertCircleOutline" class="error-icon"></IonIcon>
        <h3>Error al cargar clientes</h3>
        <p>{{ error }}</p>
        <IonButton @click="loadClients">Reintentar</IonButton>
      </div>

      <!-- Clients List -->
      <div v-else-if="clients.length > 0" class="clients-container">
        <IonList>
          <IonItem
            v-for="client in clients"
            :key="client.id"
            class="client-item"
            lines="full"
            button
            @click="goToEditClient(client.id)"
          >
            <div class="client-content">
              <div class="client-main">
                <h3 class="client-name">{{ client.name }}</h3>
                <p class="client-phone">{{ client.phone }}</p>
                <p v-if="client.email" class="client-email">{{ client.email }}</p>
              </div>
              <div v-if="client.notes" class="client-notes">
                <p>{{ client.notes }}</p>
              </div>
            </div>
          </IonItem>
        </IonList>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <IonIcon :icon="personOutline" class="empty-icon"></IonIcon>
        <h3 class="empty-title">No hay clientes</h3>
        <p class="empty-subtitle">Toca el botón + para agregar un nuevo cliente.</p>
        <IonButton @click="goToNewClient" class="add-button">
          Agregar cliente
        </IonButton>
      </div>
    </IonContent>
  </IonPage>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonMenuButton,
  IonContent,
  IonButtons,
  IonButton,
  IonBackButton,
  IonIcon,
  IonList,
  IonItem,
  IonSpinner,
} from '@ionic/vue';
import { add, alertCircleOutline, personOutline } from 'ionicons/icons';
import { auth, db } from '@/firebase/app';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getClientsBySalonId, type Client } from '@/services/clientsService';

const router = useRouter();
const route = useRoute();

const clients = ref<Client[]>([]);
const loading = ref(true);
const error = ref('');
const salonId = ref('');
const isMounted = ref(true);

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

async function loadClients() {
  if (!salonId.value || !isMounted.value) {
    if (!salonId.value) {
      error.value = 'No se encontró el salón';
      loading.value = false;
    }
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    clients.value = await getClientsBySalonId(salonId.value);
  } catch (err: any) {
    console.error('Error loading clients:', err);
    if (isMounted.value) {
      error.value = err.message || 'Error al cargar los clientes';
    }
  } finally {
    if (isMounted.value) {
      loading.value = false;
    }
  }
}

function goToNewClient() {
  router.push('/clients/new');
}

function goToEditClient(clientId: string) {
  router.push(`/clients/${clientId}/edit`);
}

onMounted(async () => {
  const id = await loadSalonId();
  if (!id) {
    error.value = 'No se encontró el salón. Por favor inicia sesión nuevamente.';
    loading.value = false;
    router.push('/onboarding');
    return;
  }
  salonId.value = id;
  await loadClients();
});

// Watch for route changes to reload clients when returning to this page
watch(
  () => route.path,
  (newPath) => {
    if (newPath === '/tabs/clients' && salonId.value && isMounted.value) {
      loadClients();
    }
  }
);

// Ionic lifecycle hook: called every time the page is about to enter
function onViewWillEnter() {
  if (salonId.value && isMounted.value) {
    loadClients();
  }
}

// Cleanup on unmount
onBeforeUnmount(() => {
  isMounted.value = false;
});
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

.clients-container {
  padding: 16px;
}

.client-item {
  --padding-start: 0;
  --inner-padding-end: 0;
  margin-bottom: 12px;
  border-radius: 8px;
  background: var(--ion-item-background);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.client-content {
  width: 100%;
  padding: 16px;
}

.client-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.client-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #222222;
}

.client-phone {
  margin: 0;
  font-size: 0.875rem;
  color: #6a6a6a;
}

.client-email {
  margin: 0;
  font-size: 0.875rem;
  color: #6a6a6a;
}

.client-notes {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e0e0e0;
}

.client-notes p {
  margin: 0;
  font-size: 0.875rem;
  color: #6a6a6a;
  font-style: italic;
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
  --border-radius: 8px;
  --background: #08b8a4;
  --background-activated: #06a894;
}
</style>


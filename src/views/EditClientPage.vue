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
        <IonTitle>Editar cliente</IonTitle>
        <IonButtons slot="end">
          <IonButton @click="handleDelete" :disabled="loading || deleting" color="danger">
            <IonIcon :icon="trashOutline" slot="icon-only"></IonIcon>
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <!-- Loading State -->
      <div v-if="loadingClient" class="loading-container">
        <IonSpinner name="crescent"></IonSpinner>
        <p>Cargando cliente...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="clientError" class="error-container">
        <IonIcon :icon="alertCircleOutline" class="error-icon"></IonIcon>
        <h3>Error al cargar cliente</h3>
        <p>{{ clientError }}</p>
        <IonButton @click="loadClient">Reintentar</IonButton>
      </div>

      <!-- Edit Form -->
      <div v-else class="form-container">
        <form @submit.prevent="handleSubmit" class="client-form">
          <IonItem>
            <IonLabel position="stacked">Nombre completo *</IonLabel>
            <IonInput
              v-model="name"
              type="text"
              placeholder="María González"
              required
              :disabled="loading || deleting"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Teléfono *</IonLabel>
            <IonInput
              v-model="phone"
              type="tel"
              placeholder="+54 11 1234-5678"
              required
              :disabled="loading || deleting"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Email</IonLabel>
            <IonInput
              v-model="email"
              type="email"
              placeholder="maria@email.com"
              :disabled="loading || deleting"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Notas</IonLabel>
            <IonTextarea
              v-model="notes"
              placeholder="Información adicional sobre el cliente..."
              rows="4"
              :disabled="loading || deleting"
            />
          </IonItem>

          <IonButton
            expand="block"
            type="submit"
            class="submit-button"
            :disabled="loading || deleting || !canSubmit"
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
import { ref, computed, onMounted } from 'vue';
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
  IonTextarea,
  IonSpinner,
  IonText,
  alertController,
} from '@ionic/vue';
import { trashOutline, alertCircleOutline, arrowBack } from 'ionicons/icons';
import { navigateToTab } from '@/utils/navigation';
import {
  getClientById,
  updateClient,
  deleteClient,
  type Client,
} from '@/services/clientsService';

const router = useRouter();
const route = useRoute();

const clientId = ref<string>('');
const name = ref('');
const phone = ref('');
const email = ref('');
const notes = ref('');
const loading = ref(false);
const loadingClient = ref(true);
const deleting = ref(false);
const error = ref('');
const clientError = ref('');

const canSubmit = computed(() => {
  return name.value.trim() && phone.value.trim();
});

function goBack() {
  navigateToTab('/tabs/clients');
}

onMounted(() => {
  const id = route.params.id as string;
  if (!id) {
    clientError.value = 'ID de cliente no válido';
    loadingClient.value = false;
    return;
  }
  clientId.value = id;
  loadClient();
});

async function loadClient() {
  loadingClient.value = true;
  clientError.value = '';

  try {
    const client = await getClientById(clientId.value);
    if (!client) {
      clientError.value = 'Cliente no encontrado';
      return;
    }

    name.value = client.name;
    phone.value = client.phone;
    email.value = client.email || '';
    notes.value = client.notes || '';
  } catch (err: any) {
    console.error('Error loading client:', err);
    clientError.value = err.message || 'Error al cargar el cliente';
  } finally {
    loadingClient.value = false;
  }
}

async function handleSubmit() {
  if (!canSubmit.value) {
    error.value = 'Por favor completa los campos obligatorios';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    await updateClient(clientId.value, {
      name: name.value.trim(),
      phone: phone.value.trim(),
      email: email.value.trim() || undefined,
      notes: notes.value.trim() || undefined,
    });

    navigateToTab('/tabs/clients');
  } catch (err: any) {
    console.error('Error updating client:', err);
    if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
      error.value = 'Error de permisos. Verifica las reglas de Firestore.';
    } else {
      error.value = err.message || 'Error al actualizar el cliente. Intenta nuevamente.';
    }
  } finally {
    loading.value = false;
  }
}

async function handleDelete() {
  const alert = await alertController.create({
    header: 'Eliminar cliente',
    message: '¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer.',
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
            await deleteClient(clientId.value);
            navigateToTab('/tabs/clients');
          } catch (err: any) {
            console.error('Error deleting client:', err);
            deleting.value = false;
            if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
              error.value = 'Error de permisos. Verifica las reglas de Firestore.';
            } else {
              error.value = err.message || 'Error al eliminar el cliente. Intenta nuevamente.';
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


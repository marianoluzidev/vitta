<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/employees"></IonBackButton>
        </IonButtons>
        <IonTitle>Editar empleado</IonTitle>
        <IonButtons slot="end">
          <IonButton @click="handleDelete" :disabled="loading || deleting" color="danger">
            <IonIcon :icon="trashOutline" slot="icon-only"></IonIcon>
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <!-- Loading State -->
      <div v-if="loadingEmployee" class="loading-container">
        <IonSpinner name="crescent"></IonSpinner>
        <p>Cargando empleado...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="employeeError" class="error-container">
        <IonIcon :icon="alertCircleOutline" class="error-icon"></IonIcon>
        <h3>Error al cargar empleado</h3>
        <p>{{ employeeError }}</p>
        <IonButton @click="loadEmployee">Reintentar</IonButton>
      </div>

      <!-- Edit Form -->
      <div v-else class="form-container">
        <form @submit.prevent="handleSubmit" class="employee-form">
          <IonItem>
            <IonLabel position="stacked">Nombre completo *</IonLabel>
            <IonInput
              v-model="name"
              type="text"
              placeholder="Juan Pérez"
              required
              :disabled="loading || deleting"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Email *</IonLabel>
            <IonInput
              v-model="email"
              type="email"
              placeholder="juan@email.com"
              required
              :disabled="loading || deleting"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Teléfono</IonLabel>
            <IonInput
              v-model="phone"
              type="tel"
              placeholder="+54 11 1234-5678"
              :disabled="loading || deleting"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Notas</IonLabel>
            <IonTextarea
              v-model="notes"
              placeholder="Información adicional sobre el empleado..."
              rows="4"
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
  IonBackButton,
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
import { trashOutline, alertCircleOutline } from 'ionicons/icons';
import {
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
  type Employee,
} from '@/services/employeesService';

const router = useRouter();
const route = useRoute();

const employeeId = ref<string>('');
const name = ref('');
const email = ref('');
const phone = ref('');
const notes = ref('');
const loading = ref(false);
const loadingEmployee = ref(true);
const deleting = ref(false);
const error = ref('');
const employeeError = ref('');

onMounted(() => {
  const id = route.params.id as string;
  if (!id) {
    employeeError.value = 'ID de empleado no válido';
    loadingEmployee.value = false;
    return;
  }
  employeeId.value = id;
  loadEmployee();
});

async function loadEmployee() {
  loadingEmployee.value = true;
  employeeError.value = '';

  try {
    const employee = await getEmployeeById(employeeId.value);
    if (!employee) {
      employeeError.value = 'Empleado no encontrado';
      return;
    }

    name.value = employee.name;
    email.value = employee.email;
    phone.value = employee.phone || '';
    notes.value = employee.notes || '';
  } catch (err: any) {
    console.error('Error loading employee:', err);
    employeeError.value = err.message || 'Error al cargar el empleado';
  } finally {
    loadingEmployee.value = false;
  }
}

async function handleSubmit() {
  if (!name.value || !email.value) {
    error.value = 'Por favor completa los campos obligatorios';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    await updateEmployee(employeeId.value, {
      name: name.value,
      email: email.value,
      phone: phone.value || undefined,
      notes: notes.value || undefined,
    });

    router.push('/tabs/employees');
  } catch (err: any) {
    console.error('Error updating employee:', err);
    if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
      error.value = 'Error de permisos. Verifica las reglas de Firestore.';
    } else {
      error.value = err.message || 'Error al actualizar el empleado. Intenta nuevamente.';
    }
  } finally {
    loading.value = false;
  }
}

async function handleDelete() {
  const alert = await alertController.create({
    header: 'Eliminar empleado',
    message: '¿Estás seguro de que deseas eliminar este empleado? Esta acción no se puede deshacer.',
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
            await deleteEmployee(employeeId.value);
            router.push('/tabs/employees');
          } catch (err: any) {
            console.error('Error deleting employee:', err);
            deleting.value = false;
            if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
              error.value = 'Error de permisos. Verifica las reglas de Firestore.';
            } else {
              error.value = err.message || 'Error al eliminar el empleado. Intenta nuevamente.';
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

.employee-form {
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


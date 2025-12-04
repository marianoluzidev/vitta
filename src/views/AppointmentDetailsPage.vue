<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/agenda"></IonBackButton>
        </IonButtons>
        <IonTitle>Detalle del turno</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <div v-if="isLoading" class="loading-container">
        <IonSpinner name="crescent"></IonSpinner>
        <p>Cargando turno...</p>
      </div>

      <div v-else-if="errorMessage" class="error-container">
        <IonText color="danger">
          <h2>{{ errorMessage }}</h2>
        </IonText>
        <IonButton expand="block" @click="router.replace({ name: 'Agenda' })">
          Volver al inicio
        </IonButton>
      </div>

      <div v-else-if="appointment" class="details-container">
        <!-- Appointment Info -->
        <div class="info-section">
          <IonItem>
            <IonLabel>
              <h2>Fecha y hora</h2>
              <p class="time-display">{{ formatTimeRange(appointment.start, appointment.end) }}</p>
              <p class="date-display">{{ formatReadableDate(appointment.start) }}</p>
            </IonLabel>
          </IonItem>

          <IonItem>
            <IonLabel>
              <h2>Cliente</h2>
              <p>{{ appointment.clientName }}</p>
              <p class="phone-display">{{ appointment.clientPhone }}</p>
              <IonButton
                v-if="appointment.clientId"
                fill="outline"
                size="small"
                @click="goToClient"
                class="view-client-button"
              >
                Ver cliente
              </IonButton>
            </IonLabel>
          </IonItem>

          <IonItem>
            <IonLabel>
              <h2>Empleado</h2>
              <p>{{ employeeName || 'Empleado no encontrado' }}</p>
            </IonLabel>
          </IonItem>

          <IonItem>
            <IonLabel>
              <h2>Servicios</h2>
              <p v-if="serviceNames.length > 0">{{ serviceNames.join(' + ') }}</p>
              <p v-else>Sin servicios</p>
            </IonLabel>
          </IonItem>

          <IonItem>
            <IonLabel>
              <h2>Estado</h2>
              <IonBadge :color="getStatusColor(appointment.status)">
                {{ getStatusLabel(appointment.status) }}
              </IonBadge>
            </IonLabel>
          </IonItem>
        </div>

        <!-- Status Actions -->
        <div class="actions-section">
          <h3 class="section-title">Estado</h3>
          <IonButton
            expand="block"
            fill="outline"
            :disabled="appointment.status === 'pending' || updatingStatus"
            @click="updateStatus('pending')"
          >
            Marcar pendiente
          </IonButton>
          <IonButton
            expand="block"
            fill="outline"
            color="success"
            :disabled="appointment.status === 'confirmed' || updatingStatus"
            @click="updateStatus('confirmed')"
          >
            Marcar confirmado
          </IonButton>
          <IonButton
            expand="block"
            fill="outline"
            color="warning"
            :disabled="appointment.status === 'cancelled' || updatingStatus"
            @click="updateStatus('cancelled')"
          >
            Cancelar turno
          </IonButton>
          <IonButton
            expand="block"
            fill="outline"
            color="medium"
            :disabled="appointment.status === 'no-show' || updatingStatus"
            @click="updateStatus('no-show')"
          >
            Marcar no-show
          </IonButton>
        </div>

        <!-- Other Actions -->
        <div class="actions-section">
          <h3 class="section-title">Acciones</h3>
          <IonButton
            expand="block"
            @click="goToEdit"
            :disabled="updatingStatus"
          >
            Editar turno
          </IonButton>
          <IonButton
            expand="block"
            color="danger"
            fill="outline"
            @click="handleDelete"
            :disabled="updatingStatus"
          >
            Eliminar turno
          </IonButton>
        </div>
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
  IonBackButton,
  IonItem,
  IonLabel,
  IonButton,
  IonBadge,
  IonSpinner,
  IonText,
} from '@ionic/vue';
import { auth, db } from '@/firebase/app';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  type Appointment,
  type AppointmentStatus,
} from '@/services/appointmentsService';
import { getEmployeesBySalonId, type Employee } from '@/services/employeesService';
import { getServicesBySalonId, type Service } from '@/services/servicesService';

const router = useRouter();
const route = useRoute();

const appointment = ref<Appointment | null>(null);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);
const salonId = ref('');
const employees = ref<Employee[]>([]);
const services = ref<Service[]>([]);
const updatingStatus = ref(false);

const employeeMap = computed(() => {
  const map = new Map<string, string>();
  employees.value.forEach((emp) => {
    map.set(emp.id, emp.name);
  });
  return map;
});

const serviceMap = computed(() => {
  const map = new Map<string, string>();
  services.value.forEach((svc) => {
    map.set(svc.id, svc.name);
  });
  return map;
});

const employeeName = computed(() => {
  if (!appointment.value) return '';
  return employeeMap.value.get(appointment.value.employeeId) || '';
});

const serviceNames = computed(() => {
  if (!appointment.value) return [];
  const serviceIdsArray = Array.isArray(appointment.value.serviceIds)
    ? appointment.value.serviceIds
    : [];
  return serviceIdsArray
    .map((serviceId) => serviceMap.value.get(serviceId))
    .filter((name): name is string => name !== undefined);
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

async function loadAppointment() {
  const appointmentId = route.params.id as string;
  if (!appointmentId) {
    errorMessage.value = 'ID de turno no válido';
    isLoading.value = false;
    return;
  }

  try {
    const apt = await getAppointmentById(appointmentId);
    if (!apt) {
      errorMessage.value = 'Turno no encontrado';
      isLoading.value = false;
      return;
    }

    // Verify salon ownership
    if (apt.salonId !== salonId.value) {
      errorMessage.value = 'No tienes permiso para ver este turno';
      isLoading.value = false;
      return;
    }

    appointment.value = apt;
  } catch (err) {
    console.error('Error loading appointment:', err);
    errorMessage.value = 'Error al cargar el turno';
  } finally {
    isLoading.value = false;
  }
}

async function loadEmployees() {
  if (!salonId.value) return;
  try {
    employees.value = await getEmployeesBySalonId(salonId.value);
  } catch (err) {
    console.error('Error loading employees:', err);
  }
}

async function loadServices() {
  if (!salonId.value) return;
  try {
    services.value = await getServicesBySalonId(salonId.value);
  } catch (err) {
    console.error('Error loading services:', err);
  }
}

async function updateStatus(newStatus: AppointmentStatus) {
  if (!appointment.value) return;

  updatingStatus.value = true;
  try {
    await updateAppointment(appointment.value.id, { status: newStatus });
    appointment.value.status = newStatus;
  } catch (err) {
    console.error('Error updating status:', err);
    errorMessage.value = 'Error al actualizar el estado del turno';
  } finally {
    updatingStatus.value = false;
  }
}

async function handleDelete() {
  if (!appointment.value) return;

  const confirmed = window.confirm(
    '¿Estás seguro de que deseas eliminar este turno? Esta acción no se puede deshacer.'
  );

  if (!confirmed) return;

  updatingStatus.value = true;
  try {
    await deleteAppointment(appointment.value.id);
    router.replace({ name: 'Agenda' });
  } catch (err) {
    console.error('Error deleting appointment:', err);
    errorMessage.value = 'Error al eliminar el turno';
    updatingStatus.value = false;
  }
}

function goToEdit() {
  if (!appointment.value) return;
  router.push(`/appointments/${appointment.value.id}/edit`);
}

function goToClient() {
  if (!appointment.value || !appointment.value.clientId) return;
  router.push(`/clients/${appointment.value.clientId}/edit`);
}

function formatTimeRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
  const endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
  return `${startTime} - ${endTime}`;
}

function formatReadableDate(isoString: string): string {
  const date = new Date(isoString);
  const months = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ];
  return `${date.getDate()} de ${months[date.getMonth()]}, ${date.getFullYear()}`;
}

function getStatusColor(status: AppointmentStatus): string {
  const colorMap: Record<AppointmentStatus, string> = {
    confirmed: 'success',
    pending: 'warning',
    cancelled: 'danger',
    'no-show': 'medium',
  };
  return colorMap[status] || 'medium';
}

function getStatusLabel(status: AppointmentStatus): string {
  const labelMap: Record<AppointmentStatus, string> = {
    confirmed: 'Confirmado',
    pending: 'Pendiente',
    cancelled: 'Cancelado',
    'no-show': 'No-show',
  };
  return labelMap[status] || status;
}

onMounted(async () => {
  // Check auth
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      router.push('/onboarding');
      return;
    }

    // Load salon
    const id = await loadSalonId();
    if (!id) {
      errorMessage.value = 'No se encontró el salón. Por favor inicia sesión nuevamente.';
      isLoading.value = false;
      router.push('/onboarding');
      return;
    }
    salonId.value = id;

    // Load employees, services, and appointment in parallel
    await Promise.all([loadEmployees(), loadServices(), loadAppointment()]);
  });
});
</script>

<style scoped>
.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 32px;
  text-align: center;
}

.loading-container p,
.error-container h2 {
  margin-top: 16px;
  color: #6a6a6a;
}

.details-container {
  padding: 16px;
}

.info-section {
  margin-bottom: 24px;
}

.info-section ion-item {
  --padding-start: 0;
  --inner-padding-end: 0;
  margin-bottom: 8px;
}

.info-section h2 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6a6a6a;
  margin: 0 0 4px 0;
}

.info-section p {
  margin: 4px 0;
  font-size: 1rem;
  color: #222222;
}

.time-display {
  font-size: 1.125rem;
  font-weight: 600;
  color: #08b8a4;
}

.date-display {
  font-size: 0.875rem;
  color: #6a6a6a;
}

.phone-display {
  font-size: 0.875rem;
  color: #6a6a6a;
}

.actions-section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #222222;
  margin: 0 0 16px 0;
}

.actions-section ion-button {
  margin-bottom: 12px;
  --border-radius: 8px;
}

.view-client-button {
  margin-top: 8px;
}
</style>


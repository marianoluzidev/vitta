<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton :default-href="backHref"></IonBackButton>
        </IonButtons>
        <IonTitle>Editar turno</IonTitle>
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
        <IonButton expand="block" @click="router.push('/home')">
          Volver al inicio
        </IonButton>
      </div>

      <div v-else class="form-container">
        <form @submit.prevent="handleSubmit" class="appointment-form">
          <IonItem>
            <IonLabel position="stacked">Buscar cliente</IonLabel>
            <IonInput
              v-model="clientSearch"
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              :disabled="isSubmitting || loadingClients"
              @ionInput="handleClientSearch"
            />
          </IonItem>

          <!-- Client Search Results -->
          <div v-if="clientSearch && filteredClients.length > 0" class="client-search-results">
            <IonItem
              v-for="client in filteredClients"
              :key="client.id"
              button
              @click="selectClient(client)"
            >
              <IonLabel>
                <h3>{{ client.name }}</h3>
                <p>{{ client.phone }}</p>
              </IonLabel>
            </IonItem>
          </div>

          <IonItem v-if="selectedClientId">
            <IonLabel>
              <p class="selected-client-info">Cliente seleccionado: {{ clientName }}</p>
              <IonButton
                fill="clear"
                size="small"
                @click="clearClientSelection"
                :disabled="isSubmitting"
              >
                Cambiar cliente
              </IonButton>
            </IonLabel>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Cliente *</IonLabel>
            <IonInput
              v-model="clientName"
              type="text"
              placeholder="Nombre del cliente"
              required
              :disabled="isSubmitting || !!selectedClientId"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Teléfono del cliente *</IonLabel>
            <IonInput
              v-model="clientPhone"
              type="tel"
              placeholder="+54 11 1234-5678"
              required
              :disabled="isSubmitting || !!selectedClientId"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Empleado *</IonLabel>
            <IonSelect
              v-model="selectedEmployeeId"
              placeholder="Seleccionar empleado"
              :disabled="isSubmitting || loadingEmployees"
              interface="popover"
            >
              <IonSelectOption
                v-for="employee in employees"
                :key="employee.id"
                :value="employee.id"
              >
                {{ employee.name }}
              </IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Servicios *</IonLabel>
            <IonSelect
              v-model="selectedServiceIds"
              placeholder="Seleccionar servicios"
              :disabled="isSubmitting || loadingServices"
              interface="popover"
              multiple
            >
              <IonSelectOption
                v-for="service in services"
                :key="service.id"
                :value="service.id"
              >
                {{ service.name }} ({{ formatDuration(service.duration) }})
              </IonSelectOption>
            </IonSelect>
          </IonItem>
          
          <IonItem v-if="selectedServiceIds.length > 0">
            <IonLabel>
              <h3>Duración total: {{ formatDuration(totalDuration) }}</h3>
              <p>Servicios seleccionados: {{ selectedServiceIds.length }}</p>
            </IonLabel>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Fecha *</IonLabel>
            <IonInput
              v-model="dateValue"
              type="date"
              :min="minDate"
              required
              :disabled="isSubmitting"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Hora de inicio *</IonLabel>
            <IonInput
              v-model="timeValue"
              type="time"
              required
              :disabled="isSubmitting"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Estado</IonLabel>
            <IonSelect
              v-model="status"
              :disabled="isSubmitting"
              interface="popover"
            >
              <IonSelectOption value="pending">Pendiente</IonSelectOption>
              <IonSelectOption value="confirmed">Confirmado</IonSelectOption>
              <IonSelectOption value="cancelled">Cancelado</IonSelectOption>
              <IonSelectOption value="no-show">No-show</IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonButton
            expand="block"
            type="submit"
            class="submit-button"
            :disabled="isSubmitting || !canSubmit"
          >
            <IonSpinner v-if="isSubmitting" name="crescent" />
            <span v-else>Guardar cambios</span>
          </IonButton>

          <div v-if="errorMessage" class="error-message">
            <IonText color="danger">{{ errorMessage }}</IonText>
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
  IonBackButton,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonSpinner,
  IonText,
} from '@ionic/vue';
import { auth, db } from '@/firebase/app';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
  getAppointmentById,
  updateAppointment,
  checkOverlappingAppointments,
  type AppointmentStatus,
} from '@/services/appointmentsService';
import { getEmployeesBySalonId, type Employee } from '@/services/employeesService';
import { getServicesBySalonId, type Service } from '@/services/servicesService';
import { getClientsBySalonId, type Client } from '@/services/clientsService';

const router = useRouter();
const route = useRoute();

const selectedEmployeeId = ref<string | null>(null);
const selectedServiceIds = ref<string[]>([]);
const clientName = ref('');
const clientPhone = ref('');
const dateValue = ref('');
const timeValue = ref('');
const status = ref<AppointmentStatus>('confirmed');
const isSubmitting = ref(false);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);
const salonId = ref('');
const employees = ref<Employee[]>([]);
const services = ref<Service[]>([]);
const clients = ref<Client[]>([]);
const clientSearch = ref('');
const selectedClientId = ref<string | null>(null);
const loadingEmployees = ref(true);
const loadingServices = ref(true);
const loadingClients = ref(true);
const appointmentId = ref<string | null>(null);

const minDate = new Date().toISOString().split('T')[0];

const backHref = computed(() => {
  if (appointmentId.value) {
    return `/appointments/${appointmentId.value}`;
  }
  return '/home';
});

const totalDuration = computed(() => {
  if (selectedServiceIds.value.length === 0) return 0;
  return services.value
    .filter((s) => selectedServiceIds.value.includes(s.id))
    .reduce((total, s) => total + s.duration, 0);
});

const canSubmit = computed(() => {
  return (
    clientName.value &&
    clientPhone.value &&
    selectedEmployeeId.value &&
    selectedServiceIds.value.length > 0 &&
    dateValue.value &&
    timeValue.value
  );
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

async function loadEmployees() {
  if (!salonId.value) return;
  loadingEmployees.value = true;
  try {
    employees.value = await getEmployeesBySalonId(salonId.value);
  } catch (err) {
    console.error('Error loading employees:', err);
  } finally {
    loadingEmployees.value = false;
  }
}

async function loadServices() {
  if (!salonId.value) return;
  loadingServices.value = true;
  try {
    services.value = await getServicesBySalonId(salonId.value);
  } catch (err) {
    console.error('Error loading services:', err);
  } finally {
    loadingServices.value = false;
  }
}

async function loadClients() {
  if (!salonId.value) return;
  loadingClients.value = true;
  try {
    clients.value = await getClientsBySalonId(salonId.value);
  } catch (err) {
    console.error('Error loading clients:', err);
  } finally {
    loadingClients.value = false;
  }
}

const filteredClients = computed(() => {
  if (!clientSearch.value.trim()) {
    return [];
  }
  const searchLower = clientSearch.value.toLowerCase().trim();
  return clients.value.filter(
    (client) =>
      client.name.toLowerCase().includes(searchLower) ||
      client.phone.includes(searchLower)
  );
});

function selectClient(client: Client) {
  selectedClientId.value = client.id;
  clientName.value = client.name;
  clientPhone.value = client.phone;
  clientSearch.value = '';
}

function clearClientSelection() {
  selectedClientId.value = null;
  clientName.value = '';
  clientPhone.value = '';
  clientSearch.value = '';
}

function handleClientSearch() {
  // Reset selection if user starts typing again
  if (selectedClientId.value && clientSearch.value !== '') {
    selectedClientId.value = null;
  }
}

async function loadAppointment() {
  const id = route.params.id as string;
  if (!id) {
    errorMessage.value = 'ID de turno no válido';
    isLoading.value = false;
    return;
  }

  appointmentId.value = id;

  try {
    const appointment = await getAppointmentById(id);
    if (!appointment) {
      errorMessage.value = 'Turno no encontrado';
      isLoading.value = false;
      return;
    }

    // Verify salon ownership
    if (appointment.salonId !== salonId.value) {
      errorMessage.value = 'No tienes permiso para editar este turno';
      isLoading.value = false;
      return;
    }

    // Pre-fill form
    clientName.value = appointment.clientName;
    clientPhone.value = appointment.clientPhone;
    selectedClientId.value = appointment.clientId || null;
    selectedEmployeeId.value = appointment.employeeId;
    selectedServiceIds.value = Array.isArray(appointment.serviceIds)
      ? appointment.serviceIds
      : [];

    // Parse date and time from ISO string
    const startDate = new Date(appointment.start);
    dateValue.value = startDate.toISOString().split('T')[0];
    const hours = startDate.getHours().toString().padStart(2, '0');
    const minutes = startDate.getMinutes().toString().padStart(2, '0');
    timeValue.value = `${hours}:${minutes}`;

    status.value = appointment.status;
  } catch (err) {
    console.error('Error loading appointment:', err);
    errorMessage.value = 'Error al cargar el turno';
  } finally {
    isLoading.value = false;
  }
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

async function handleSubmit() {
  if (!canSubmit.value) {
    errorMessage.value = 'Por favor completa todos los campos obligatorios';
    return;
  }

  if (!salonId.value || !appointmentId.value) {
    errorMessage.value = 'Error: No se encontró el salón o el turno';
    return;
  }

  if (selectedServiceIds.value.length === 0) {
    errorMessage.value = 'Error: Debes seleccionar al menos un servicio';
    return;
  }

  // Verify all selected services exist
  const selectedServices = services.value.filter((s) =>
    selectedServiceIds.value.includes(s.id)
  );
  if (selectedServices.length !== selectedServiceIds.value.length) {
    errorMessage.value = 'Error: Uno o más servicios no fueron encontrados';
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = null;

  try {
    // Combine date and time
    const [year, month, day] = dateValue.value.split('-').map(Number);
    const [hours, minutes] = timeValue.value.split(':').map(Number);
    const startDateTime = new Date(year, month - 1, day, hours, minutes);

    // Calculate total duration from all selected services
    const totalDurationMinutes = selectedServices.reduce(
      (total, s) => total + s.duration,
      0
    );
    const endDateTime = new Date(
      startDateTime.getTime() + totalDurationMinutes * 60000
    );

    // Check for overlapping appointments (excluding current appointment)
    const hasOverlap = await checkOverlappingAppointments(
      salonId.value,
      selectedEmployeeId.value!,
      startDateTime.toISOString(),
      endDateTime.toISOString(),
      appointmentId.value
    );

    if (hasOverlap) {
      errorMessage.value =
        'El empleado ya tiene un turno en este horario. Por favor selecciona otro horario o empleado.';
      isSubmitting.value = false;
      return;
    }

    await updateAppointment(appointmentId.value, {
      employeeId: selectedEmployeeId.value!,
      serviceIds: selectedServiceIds.value,
      clientName: clientName.value,
      clientPhone: clientPhone.value,
      clientId: selectedClientId.value || undefined,
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
      status: status.value,
    });

    // Navigate back to details page
    router.push(`/appointments/${appointmentId.value}`);
  } catch (err: any) {
    console.error('Error updating appointment:', err);
    if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
      errorMessage.value = 'Error de permisos. Verifica las reglas de Firestore.';
    } else {
      errorMessage.value = err.message || 'Error al actualizar el turno. Intenta nuevamente.';
    }
  } finally {
    isSubmitting.value = false;
  }
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

    // Load employees, services, clients, and appointment in parallel
    await Promise.all([loadEmployees(), loadServices(), loadClients()]);
    await loadAppointment();
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

.form-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100%;
  padding: 32px;
}

.appointment-form {
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

.client-search-results {
  margin: 0 16px 16px 16px;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: var(--ion-background-color);
}

.client-search-results ion-item {
  margin-bottom: 0;
  --border-radius: 0;
}

.selected-client-info {
  color: #08b8a4;
  font-weight: 500;
  margin-bottom: 4px;
}
</style>


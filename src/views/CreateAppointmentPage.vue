<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/tabs/agenda"></IonBackButton>
        </IonButtons>
        <IonTitle>Nuevo turno</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <div class="form-container">
        <form @submit.prevent="handleSubmit" class="appointment-form">
          <IonItem>
            <IonLabel position="stacked">Buscar cliente</IonLabel>
            <IonInput
              v-model="clientSearch"
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              :disabled="loading || loadingClients"
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
                :disabled="loading"
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
              :disabled="loading || !!selectedClientId"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Teléfono del cliente *</IonLabel>
            <IonInput
              v-model="clientPhone"
              type="tel"
              placeholder="+54 11 1234-5678"
              required
              :disabled="loading || !!selectedClientId"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Empleado *</IonLabel>
            <IonSelect
              v-model="employeeId"
              placeholder="Seleccionar empleado"
              :disabled="loading || loadingEmployees"
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
              v-model="serviceIds"
              placeholder="Seleccionar servicios"
              :disabled="loading || loadingServices"
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
          
          <IonItem v-if="serviceIds.length > 0">
            <IonLabel>
              <h3>Duración total: {{ formatDuration(totalDuration) }}</h3>
              <p>Servicios seleccionados: {{ serviceIds.length }}</p>
            </IonLabel>
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Fecha *</IonLabel>
            <IonInput
              v-model="selectedDate"
              type="date"
              :min="minDate"
              required
              :disabled="loading"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Hora de inicio *</IonLabel>
            <IonInput
              v-model="startTime"
              type="time"
              required
              :disabled="loading"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Estado</IonLabel>
            <IonSelect
              v-model="status"
              :disabled="loading"
              interface="popover"
            >
              <IonSelectOption value="pending">Pendiente</IonSelectOption>
              <IonSelectOption value="confirmed">Confirmado</IonSelectOption>
              <IonSelectOption value="cancelled">Cancelado</IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonButton
            expand="block"
            type="submit"
            class="submit-button"
            :disabled="loading || !canSubmit"
          >
            <IonSpinner v-if="loading" name="crescent" />
            <span v-else>Crear turno</span>
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
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
import { createAppointment, checkOverlappingAppointments, type CreateAppointmentPayload } from '@/services/appointmentsService';
import { getEmployeesBySalonId, type Employee } from '@/services/employeesService';
import { getServicesBySalonId, type Service } from '@/services/servicesService';
import { getClientsBySalonId, type Client } from '@/services/clientsService';
import { navigateToTab } from '@/utils/navigation';

const router = useRouter();
const route = useRoute();

const clientName = ref('');
const clientPhone = ref('');
const employeeId = ref('');
const serviceIds = ref<string[]>([]);
const selectedDate = ref(new Date().toISOString().split('T')[0]);
const startTime = ref('09:00');
const status = ref<'pending' | 'confirmed' | 'cancelled'>('confirmed');
const loading = ref(false);
const loadingEmployees = ref(true);
const loadingServices = ref(true);
const loadingClients = ref(true);
const error = ref('');
const salonId = ref('');
const employees = ref<Employee[]>([]);
const services = ref<Service[]>([]);
const clients = ref<Client[]>([]);
const clientSearch = ref('');
const selectedClientId = ref<string | null>(null);

const minDate = new Date().toISOString().split('T')[0];

function resetForm() {
  clientName.value = '';
  clientPhone.value = '';
  clientSearch.value = '';
  selectedClientId.value = null;
  employeeId.value = '';
  serviceIds.value = [];
  selectedDate.value = new Date().toISOString().split('T')[0];
  startTime.value = '09:00';
  status.value = 'confirmed';
  error.value = '';
}

const totalDuration = computed(() => {
  if (serviceIds.value.length === 0) return 0;
  return services.value
    .filter((s) => serviceIds.value.includes(s.id))
    .reduce((total, s) => total + s.duration, 0);
});

const canSubmit = computed(() => {
  return (
    clientName.value &&
    clientPhone.value &&
    employeeId.value &&
    serviceIds.value.length > 0 &&
    selectedDate.value &&
    startTime.value
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

onMounted(async () => {
  // Reset form when component mounts
  resetForm();
  
  const id = await loadSalonId();
  if (!id) {
    error.value = 'No se encontró el salón. Por favor inicia sesión nuevamente.';
    router.push('/onboarding');
    return;
  }
  salonId.value = id;
  await Promise.all([loadEmployees(), loadServices(), loadClients()]);
});

// Watch removed - totalDuration computed property handles calculation

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
    error.value = 'Por favor completa todos los campos obligatorios';
    return;
  }

  if (!salonId.value) {
    error.value = 'Error: No se encontró el salón';
    return;
  }

  if (serviceIds.value.length === 0) {
    error.value = 'Error: Debes seleccionar al menos un servicio';
    return;
  }

  // Verify all selected services exist
  const selectedServices = services.value.filter((s) => serviceIds.value.includes(s.id));
  if (selectedServices.length !== serviceIds.value.length) {
    error.value = 'Error: Uno o más servicios no fueron encontrados';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    // Combine date and time
    const [year, month, day] = selectedDate.value.split('-').map(Number);
    const [hours, minutes] = startTime.value.split(':').map(Number);
    const startDateTime = new Date(year, month - 1, day, hours, minutes);
    
    // Calculate total duration from all selected services
    const totalDurationMinutes = selectedServices.reduce((total, s) => total + s.duration, 0);
    const endDateTime = new Date(startDateTime.getTime() + totalDurationMinutes * 60000);

    // Check for overlapping appointments
    const hasOverlap = await checkOverlappingAppointments(
      salonId.value,
      employeeId.value,
      startDateTime.toISOString(),
      endDateTime.toISOString()
    );

    if (hasOverlap) {
      error.value = 'El empleado ya tiene un turno en este horario. Por favor selecciona otro horario o empleado.';
      loading.value = false;
      return;
    }

    const payload: CreateAppointmentPayload = {
      salonId: salonId.value,
      employeeId: employeeId.value,
      serviceIds: serviceIds.value,
      clientName: clientName.value,
      clientPhone: clientPhone.value,
      clientId: selectedClientId.value || undefined,
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
      status: status.value,
    };

    await createAppointment(payload);
    
    // Reset form after successful creation
    resetForm();
    
    // Navigate back to agenda tab safely
    await nextTick();
    navigateToTab('/tabs/agenda', 100);
  } catch (err: any) {
    console.error('Error creating appointment:', err);
    if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
      error.value = 'Error de permisos. Verifica las reglas de Firestore.';
    } else {
      error.value = err.message || 'Error al crear el turno. Intenta nuevamente.';
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


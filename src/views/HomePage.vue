<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <IonPage @ionViewWillEnter="onViewWillEnter">
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
        <IonButtons slot="start">
          <IonMenuButton menu="main-menu"></IonMenuButton>
        </IonButtons>
        <IonTitle class="logo-title">
          Vitta
          <span class="salon-name">{{ displaySalonName }}</span>
          <span class="version">v{{ appVersion }}</span>
        </IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <!-- Date Selector Section -->
      <div class="date-selector-section">
        <div class="date-navigation">
          <IonButton fill="clear" @click="previousDay">
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
            <IonIcon :icon="chevronBackOutline" slot="icon-only" />
          </IonButton>

          <div class="date-display">
            <h2 class="date-text">{{ formattedDate }}</h2>
          </div>

          <IonButton fill="clear" @click="nextDay">
            <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
            <IonIcon :icon="chevronForwardOutline" slot="icon-only" />
          </IonButton>
        </div>

        <!-- Segmented Control -->
        <IonSegment v-model="viewMode" class="view-mode-segment">
          <IonSegmentButton value="day">
            <IonLabel>Día</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="week">
            <IonLabel>Semana</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      <!-- Loading Appointments -->
      <div v-if="loadingAppointments" class="loading-appointments">
        <IonSpinner name="crescent"></IonSpinner>
        <p>Cargando turnos...</p>
      </div>

      <!-- Appointments List -->
      <div v-else-if="filteredAppointments.length > 0" class="appointments-container">
        <IonList>
          <IonItem v-for="appointment in filteredAppointments" :key="appointment.id" class="appointment-item"
            lines="full" button @click="goToAppointmentDetails(appointment.id)">
            <div class="appointment-content">
              <div class="appointment-time">
                {{ formatTime(appointment.start) }} - {{ formatTime(appointment.end) }}
              </div>

              <div class="appointment-details">
                <div class="appointment-main">
                  <h3 class="client-name">{{ appointment.clientName }}</h3>
                  <p v-if="appointment.serviceNames && appointment.serviceNames.length > 0" class="service-name">
                    {{ formatServiceSummary(appointment.serviceNames) }}
                  </p>
                  <p v-else class="service-name">Sin servicios</p>
                </div>

                <div class="appointment-meta">
                  <span v-if="appointment.employeeName" class="employee-name">{{ appointment.employeeName }}</span>
                  <span v-else class="employee-name">Empleado no encontrado</span>
                  <IonBadge :color="getStatusColor(appointment.status)" class="status-badge">
                    {{ getStatusLabel(appointment.status) }}
                  </IonBadge>
                </div>
              </div>
            </div>
          </IonItem>
        </IonList>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <IonIcon :icon="calendarOutline" class="empty-icon" />
        <h3 class="empty-title">Sin turnos para este día</h3>
        <p class="empty-subtitle">Toca el botón + para crear un nuevo turno.</p>
      </div>

      <!-- Floating Action Button --><!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
      <IonFab vertical="bottom" horizontal="end">
        <IonFabButton @click="goToCreateAppointment">
          <IonIcon :icon="add" />
        </IonFabButton>
      </IonFab>
    </IonContent>
  </IonPage>
</template>
  
  <script setup lang="ts">
  import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
  IonContent,
  IonButton,
  IonIcon,
    IonSegment,
    IonSegmentButton,
    IonLabel,
  IonList,
  IonItem,
  IonBadge,
  IonFab,
  IonFabButton,
  IonSpinner,
  IonMenuButton,
} from '@ionic/vue';
  import {
    chevronBackOutline,
    chevronForwardOutline,
    calendarOutline,
    add,
  } from 'ionicons/icons';
import { auth, db } from '@/firebase/app';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { themes } from '@/theme/themes';
import { applyTheme } from '@/theme/applyTheme';
  
  // Types
  import type { AppointmentStatus } from '@/services/appointmentsService';
  import type { Appointment } from '@/services/appointmentsService';
  import { getAppointmentsBySalonIdAndDate, getAppointmentsBySalonIdAndDateRange } from '@/services/appointmentsService';
  import {
    getEmployeesBySalonId,
    type Employee,
  } from '@/services/employeesService';
  import {
    getServicesBySalonId,
    type Service,
  } from '@/services/servicesService';
  
  interface AppointmentWithDetails extends Appointment {
    serviceNames: string[];
    employeeName?: string;
  }
  
  // App version (injected by Vite)
  declare const __APP_VERSION__: string;
  const appVersion = __APP_VERSION__;

  // State
  const router = useRouter();
  const route = useRoute();
  const selectedSalon = ref('');
  const selectedSalonId = ref('');
  const selectedDate = ref(new Date());
  const viewMode = ref<'day' | 'week'>('day');
  const loadingSalon = ref(true);
  const salonError = ref(false);
  const appointments = ref<AppointmentWithDetails[]>([]);
  const loadingAppointments = ref(false);
  const isMounted = ref(true);
  
  // Employees and services for lookup
  const employees = ref<Employee[]>([]);
  const services = ref<Service[]>([]);
  const loadingEmployees = ref(false);
  const loadingServices = ref(false);
  
  // Lookup maps
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

  // Computed
  const displaySalonName = computed(() => {
    if (loadingSalon.value) {
      return 'Cargando salón…';
    }
    if (salonError.value || !selectedSalon.value) {
      return 'Sin salón';
    }
    return selectedSalon.value;
  });

  // Load salon data on mount
  onMounted(() => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // No user logged in, redirect to onboarding
        router.push('/onboarding');
        return;
      }

      // User is logged in, fetch salon
      loadingSalon.value = true;
      salonError.value = false;

      try {
        const salonsRef = collection(db, 'salons');
        const q = query(salonsRef, where('ownerId', '==', user.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Found salon, get the first one
          const salonDoc = querySnapshot.docs[0];
          const salonData = salonDoc.data();
          selectedSalon.value = salonData.name || 'Sin nombre';
          selectedSalonId.value = salonDoc.id;
          
          // Load and apply theme from Firestore
          const theme = salonData.theme || 'vitta';
          if (theme in themes) {
            applyTheme(theme as keyof typeof themes);
            localStorage.setItem('theme', theme);
          } else {
            // Fallback to vitta if theme is invalid
            applyTheme('vitta');
            localStorage.setItem('theme', 'vitta');
          }
          
          // Load employees, services, and appointments after salon is loaded
          await Promise.all([
            loadEmployees(),
            loadServices(),
          ]);
          loadAppointments();
        } else {
          // No salon found
          salonError.value = true;
          selectedSalon.value = '';
          selectedSalonId.value = '';
        }
      } catch (error) {
        console.error('Error fetching salon:', error);
        salonError.value = true;
        selectedSalon.value = '';
      } finally {
        loadingSalon.value = false;
      }
    });
  });

  // Computed
  const formattedDate = computed(() => {
    if (viewMode.value === 'week') {
      // Calculate week range (Monday to Sunday)
      const date = new Date(selectedDate.value);
      const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
      const monday = new Date(date.getFullYear(), date.getMonth(), diff);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

      // If both dates are in the same month
      if (monday.getMonth() === sunday.getMonth()) {
        return `${monday.getDate()} - ${sunday.getDate()} de ${formatMonth(monday)}`;
      } else {
        // Different months
        return `${monday.getDate()} ${formatMonth(monday)} - ${sunday.getDate()} ${formatMonth(sunday)}`;
      }
    }

    // Day view
    const today = new Date();
    const date = selectedDate.value;
  
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  
    if (isToday) {
      return `Hoy, ${formatDate(date)}`;
    }
  
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear();
  
    if (isTomorrow) {
      return `Mañana, ${formatDate(date)}`;
    }
  
    return formatDate(date);
  });
  
  // Load employees for the current salon
  async function loadEmployees() {
    if (!selectedSalonId.value) {
      return;
    }

    loadingEmployees.value = true;
    try {
      employees.value = await getEmployeesBySalonId(selectedSalonId.value);
    } catch (err) {
      console.error('Error loading employees:', err);
      employees.value = [];
    } finally {
      loadingEmployees.value = false;
    }
  }

  // Load services for the current salon
  async function loadServices() {
    if (!selectedSalonId.value) {
      return;
    }

    loadingServices.value = true;
    try {
      services.value = await getServicesBySalonId(selectedSalonId.value);
    } catch (err) {
      console.error('Error loading services:', err);
      services.value = [];
    } finally {
      loadingServices.value = false;
    }
  }

  // Load appointments from Firestore
  async function loadAppointments() {
    if (!selectedSalonId.value) {
      return;
    }

    loadingAppointments.value = true;

    try {
      let appointmentsData: Appointment[];

      if (viewMode.value === 'week') {
        // Calculate week range (Monday to Sunday of the week containing selectedDate)
        const date = new Date(selectedDate.value);
        const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
        const monday = new Date(date.getFullYear(), date.getMonth(), diff);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        appointmentsData = await getAppointmentsBySalonIdAndDateRange(
          selectedSalonId.value,
          monday,
          sunday
        );
      } else {
        // Day view
        appointmentsData = await getAppointmentsBySalonIdAndDate(
          selectedSalonId.value,
          selectedDate.value
        );
      }

      // Use lookup maps to enrich appointment data
      const appointmentsWithDetails: AppointmentWithDetails[] = appointmentsData.map((apt) => {
        const appointmentWithDetails: AppointmentWithDetails = { 
          ...apt,
          serviceNames: [], // Initialize as empty array
        };

        // Get employee name from map
        appointmentWithDetails.employeeName = employeeMap.value.get(apt.employeeId) || undefined;

        // Ensure serviceIds is always an array (handle migration from old format)
        const serviceIdsArray = Array.isArray(apt.serviceIds) ? apt.serviceIds : [];
        
        // Get service names from map
        appointmentWithDetails.serviceNames = serviceIdsArray
          .map((serviceId) => serviceMap.value.get(serviceId))
          .filter((name): name is string => name !== undefined);

        return appointmentWithDetails;
      });

      // Only update if component is still mounted (prevent updates after navigation)
      if (isMounted.value) {
        appointments.value = appointmentsWithDetails;
      }
    } catch (err) {
      console.error('Error loading appointments:', err);
      // Only update if component is still mounted
      if (isMounted.value) {
        appointments.value = [];
      }
    } finally {
      // Only update if component is still mounted
      if (isMounted.value) {
        loadingAppointments.value = false;
      }
    }
  }

  const filteredAppointments = computed(() => {
    // Appointments are already filtered by date range in loadAppointments
    // based on viewMode, so we just return all appointments
    return appointments.value;
  });
  
  // Helpers
  function formatDate(date: Date): string {
    return `${date.getDate()} de ${formatMonth(date)}`;
  }

  function formatMonth(date: Date): string {
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
    return months[date.getMonth()];
  }
  
  function formatTime(isoString: string): string {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  function previousDay() {
    const newDate = new Date(selectedDate.value);
    newDate.setDate(newDate.getDate() - 1);
    selectedDate.value = newDate;
    loadAppointments();
  }
  
  function nextDay() {
    const newDate = new Date(selectedDate.value);
    newDate.setDate(newDate.getDate() + 1);
    selectedDate.value = newDate;
    loadAppointments();
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
      confirmed: 'confirmado',
      pending: 'pendiente',
      cancelled: 'cancelado',
      'no-show': 'no-show',
    };
    return labelMap[status] || status;
  }

  function formatServiceSummary(serviceNames: string[]): string {
    if (serviceNames.length === 0) {
      return 'Sin servicios';
    }
    if (serviceNames.length === 1) {
      return serviceNames[0];
    }
    // For multiple services, join with " + "
    return serviceNames.join(' + ');
  }
  
  function goToCreateAppointment() {
    router.push({ path: '/appointments/new', query: { from: 'agenda' } });
  }

  // Navigation functions removed - now handled by tabs

  function goToAppointmentDetails(appointmentId: string) {
    router.push(`/appointments/${appointmentId}`);
  }

  // Watch for date changes to reload appointments
  watch(selectedDate, () => {
    if (selectedSalonId.value && isMounted.value) {
      loadAppointments();
    }
  });

  // Watch for view mode changes to reload appointments
  watch(viewMode, () => {
    if (selectedSalonId.value && isMounted.value) {
      loadAppointments();
    }
  });

  // Watch for route changes to reload appointments when returning to home
  watch(
    () => route.path,
    (newPath) => {
      // Reload appointments when navigating back to home/agenda
      if ((newPath === '/home' || newPath === '/tabs/agenda') && selectedSalonId.value && isMounted.value) {
        loadAppointments();
      }
    }
  );

  // Ionic lifecycle hook: called every time the page is about to enter
  // This ensures data is refreshed when navigating back to home
  function onViewWillEnter() {
    if (selectedSalonId.value && isMounted.value) {
      loadAppointments();
    }
  }

  // Cleanup on unmount
  onBeforeUnmount(() => {
    isMounted.value = false;
  });
  </script>
  
  <style scoped>
  .logo-title {
    font-weight: 600;
    color: #08b8a4;
    font-size: 1.2rem;
    margin-left: 0px;
  }
  
  .date-selector-section {
    padding: 16px;
    background: var(--ion-background-color);
  }
  
  .date-navigation {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  
  .date-display {
    flex: 1;
    text-align: center;
  }
  
  .date-text {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #222222;
  }
  
  .view-mode-segment {
    margin-top: 8px;
  }
  
  .appointments-container {
    padding: 0 16px;
  }
  
  .appointment-item {
    --padding-start: 0;
    --inner-padding-end: 0;
    margin-bottom: 12px;
    border-radius: 8px;
    background: var(--ion-item-background);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  .appointment-content {
    width: 100%;
    padding: 16px;
  }
  
  .appointment-time {
    font-size: 0.875rem;
    font-weight: 600;
    color: #08b8a4;
    margin-bottom: 8px;
  }
  
  .appointment-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .appointment-main {
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
  
  .service-name {
    margin: 0;
    font-size: 0.875rem;
    color: #6a6a6a;
  }
  
  .appointment-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }
  
  .employee-name {
    font-size: 0.75rem;
    color: #6a6a6a;
  }
  
  .status-badge {
    font-size: 0.75rem;
    font-weight: 500;
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
    margin: 0;
    font-size: 0.875rem;
    color: #6a6a6a;
  }

  .loading-appointments {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 32px;
    text-align: center;
  }

  .loading-appointments p {
    margin-top: 16px;
    color: #6a6a6a;
  }
  
  ion-fab-button {
    --background: #08b8a4;
    --background-activated: #06a894;
    --background-hover: #07c4b0;
  }
  .logo-title {
  font-weight: 600;
  color: #08b8a4;
  font-size: 1.2rem;
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.salon-name {
  font-weight: 400;
  font-size: 0.8rem;
  color: #6a6a6a;
}

.version {
  font-weight: 300;
  font-size: 0.7rem;
  color: #999;
  margin-left: 4px;
}

  
  </style>
  
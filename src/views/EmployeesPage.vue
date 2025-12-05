<!-- eslint-disable vue/no-deprecated-slot-attribute -->
<template>
  <IonPage @ionViewWillEnter="onViewWillEnter">
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
        <IonButtons slot="start">
          <IonMenuButton menu="main-menu"></IonMenuButton>
        </IonButtons>
        <IonTitle>Empleados</IonTitle>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
        <IonButtons slot="end">
          <IonButton @click="goToNewEmployee" :disabled="loading">
            <IonIcon :icon="add" slot="icon-only"></IonIcon>
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <!-- Loading State -->
      <div v-if="loading" class="loading-container">
        <IonSpinner name="crescent"></IonSpinner>
        <p>Cargando empleados...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-container">
        <IonIcon :icon="alertCircleOutline" class="error-icon"></IonIcon>
        <h3>Error al cargar empleados</h3>
        <p>{{ error }}</p>
        <IonButton @click="loadEmployees">Reintentar</IonButton>
      </div>

      <!-- Employees List -->
      <div v-else-if="employees.length > 0" class="employees-container">
        <IonList>
          <IonItem
            v-for="employee in employees"
            :key="employee.id"
            class="employee-item"
            lines="full"
            button
            @click="goToEditEmployee(employee.id)"
          >
            <div class="employee-content">
              <div class="employee-main">
                <h3 class="employee-name">{{ employee.name }}</h3>
                <p class="employee-email">{{ employee.email }}</p>
                <p v-if="employee.phone" class="employee-phone">{{ employee.phone }}</p>
              </div>
              <div v-if="employee.notes" class="employee-notes">
                <p>{{ employee.notes }}</p>
              </div>
            </div>
          </IonItem>
        </IonList>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <IonIcon :icon="peopleOutline" class="empty-icon"></IonIcon>
        <h3 class="empty-title">No hay empleados</h3>
        <p class="empty-subtitle">Toca el botón + para agregar un nuevo empleado.</p>
        <IonButton @click="goToNewEmployee" class="add-button">
          Agregar empleado
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
import { add, alertCircleOutline, peopleOutline } from 'ionicons/icons';
import { auth, db } from '@/firebase/app';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { getEmployeesBySalonId, type Employee } from '@/services/employeesService';

const router = useRouter();
const route = useRoute();

const employees = ref<Employee[]>([]);
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

async function loadEmployees() {
  if (!isMounted.value) {
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    if (!salonId.value) {
      const id = await loadSalonId();
      if (!id) {
        if (isMounted.value) {
          error.value = 'No se encontró el salón. Por favor inicia sesión nuevamente.';
          loading.value = false;
        }
        return;
      }
      salonId.value = id;
    }

    if (!isMounted.value) return;

    employees.value = await getEmployeesBySalonId(salonId.value);
  } catch (err: any) {
    console.error('Error loading employees:', err);
    if (isMounted.value) {
      error.value = err.message || 'Error al cargar los empleados';
    }
  } finally {
    if (isMounted.value) {
      loading.value = false;
    }
  }
}

function goToNewEmployee() {
  router.push('/employees/new');
}

function goToEditEmployee(employeeId: string) {
  router.push(`/employees/${employeeId}/edit`);
}

onMounted(() => {
  loadEmployees();
});

// Watch for route changes to reload employees when returning to this page
watch(
  () => route.path,
  (newPath) => {
    if (newPath === '/tabs/employees' && salonId.value && isMounted.value) {
      loadEmployees();
    }
  }
);

// Ionic lifecycle hook: called every time the page is about to enter
function onViewWillEnter() {
  if (salonId.value && isMounted.value) {
    loadEmployees();
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

.employees-container {
  padding: 16px;
}

.employee-item {
  --padding-start: 0;
  --inner-padding-end: 0;
  margin-bottom: 12px;
  border-radius: 8px;
  background: var(--ion-item-background);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.employee-content {
  width: 100%;
  padding: 16px;
}

.employee-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.employee-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #222222;
}

.employee-email {
  margin: 0;
  font-size: 0.875rem;
  color: #6a6a6a;
}

.employee-phone {
  margin: 4px 0 0 0;
  font-size: 0.875rem;
  color: #6a6a6a;
}

.employee-notes {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.employee-notes p {
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
  --background: #08b8a4;
  --background-activated: #06a894;
}
</style>


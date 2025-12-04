<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Más</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <div class="more-container">
        <IonList>
          <IonItem>
            <IonIcon :icon="personCircleOutline" slot="start" />
            <IonLabel>
              <h2>Perfil</h2>
              <p>Configuración de cuenta</p>
            </IonLabel>
          </IonItem>

          <IonItem>
            <IonIcon :icon="settingsOutline" slot="start" />
            <IonLabel>
              <h2>Configuración</h2>
              <p>Preferencias del salón</p>
            </IonLabel>
          </IonItem>

          <IonItem button @click="handleLogout">
            <IonIcon :icon="logOutOutline" slot="start" color="danger" />
            <IonLabel>
              <h2>Cerrar sesión</h2>
            </IonLabel>
          </IonItem>
        </IonList>
      </div>
    </IonContent>
  </IonPage>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { signOut } from 'firebase/auth';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
} from '@ionic/vue';
import {
  personCircleOutline,
  settingsOutline,
  logOutOutline,
} from 'ionicons/icons';
import { auth } from '@/firebase/app';

const router = useRouter();

async function handleLogout() {
  try {
    await signOut(auth);
    // Navigate to onboarding
    router.push('/onboarding').catch(() => {
      // Fallback if navigation fails
      window.location.href = '/onboarding';
    });
  } catch (error) {
    console.error('Error signing out:', error);
  }
}
</script>

<style scoped>
.more-container {
  padding: 16px;
}

ion-item {
  margin-bottom: 8px;
  --border-radius: 8px;
}
</style>


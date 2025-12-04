<template>
  <IonPage>
    <IonContent :fullscreen="true" class="onboarding-content">
      <div class="onboarding-container">
        <div class="logo-section">
          <h1 class="app-title">Vitta</h1>
          <p class="app-tagline">tu tiempo en orden</p>
        </div>

        <div class="buttons-section">
          <IonButton
            expand="block"
            size="large"
            class="onboarding-button owner-button"
            @click="goToRegisterOwner"
          >
            Soy dueño de un negocio
          </IonButton>

          <IonButton
            expand="block"
            size="large"
            fill="outline"
            class="onboarding-button employee-button"
            @click="goToLogin"
          >
            Fui invitado como empleado
          </IonButton>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>

<script setup lang="ts">
import { IonPage, IonContent, IonButton } from '@ionic/vue';
import { useRouter } from 'vue-router';

const router = useRouter();

function goToRegisterOwner() {
  router.push('/register-owner');
}

function goToLogin() {
  router.push('/login');
}
</script>

<style scoped>
.onboarding-content {
  --background: linear-gradient(135deg, #08b8a4 0%, #06a894 100%);
}

.onboarding-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  padding: 32px;
}

.logo-section {
  text-align: center;
  margin-bottom: 64px;
}

.app-title {
  font-size: 3rem;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 8px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.app-tagline {
  font-size: 1.125rem;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  font-weight: 300;
}

.buttons-section {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.onboarding-button {
  --border-radius: 12px;
  --padding-top: 20px;
  --padding-bottom: 20px;
  font-weight: 600;
  font-size: 1rem;
  text-transform: none;
  height: 56px;
}

.owner-button {
  --background: #ffffff;
  --color: #08b8a4;
  --background-activated: rgba(255, 255, 255, 0.9);
}

.employee-button {
  --border-color: #ffffff;
  --color: #ffffff;
  --background-activated: rgba(255, 255, 255, 0.1);
}
</style>




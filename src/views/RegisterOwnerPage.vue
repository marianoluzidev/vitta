<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Registrarse como dueño</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <div class="register-container">
        <form @submit.prevent="handleRegister" class="register-form">
          <IonItem>
            <IonLabel position="stacked">Nombre completo</IonLabel>
            <IonInput
              v-model="name"
              type="text"
              placeholder="Juan Pérez"
              required
              :disabled="loading"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Email</IonLabel>
            <IonInput
              v-model="email"
              type="email"
              placeholder="tu@email.com"
              required
              :disabled="loading"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Contraseña</IonLabel>
            <IonInput
              v-model="password"
              type="password"
              placeholder="••••••••"
              required
              :disabled="loading"
            />
          </IonItem>

          <IonItem>
            <IonLabel position="stacked">Nombre del salón</IonLabel>
            <IonInput
              v-model="salonName"
              type="text"
              placeholder="Mi Salón"
              required
              :disabled="loading"
            />
          </IonItem>

          <IonButton
            expand="block"
            type="submit"
            class="submit-button"
            :disabled="loading"
          >
            <IonSpinner v-if="loading" name="crescent" />
            <span v-else>Crear cuenta</span>
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
import { ref, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonSpinner,
  IonText,
} from '@ionic/vue';
import { registerOwner, type RegisterOwnerPayload } from '@/services/authService';

const router = useRouter();

const name = ref('');
const email = ref('');
const password = ref('');
const salonName = ref('');
const loading = ref(false);
const error = ref('');

async function handleRegister() {
  if (!name.value || !email.value || !password.value || !salonName.value) {
    error.value = 'Por favor completa todos los campos';
    return;
  }

  if (password.value.length < 6) {
    error.value = 'La contraseña debe tener al menos 6 caracteres';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const payload: RegisterOwnerPayload = {
      name: name.value,
      email: email.value,
      password: password.value,
      salonName: salonName.value,
    };

    await registerOwner(payload);
    
    // Wait for auth state to update
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Force full page reload to avoid Ionic navigation stack issues
    // when transitioning from non-tab page to tab page
    window.location.href = '/tabs/agenda';
  } catch (err: any) {
    console.error('Registration error:', err);
    if (err.code === 'auth/email-already-in-use') {
      error.value = 'Este email ya está registrado';
    } else if (err.code === 'auth/invalid-email') {
      error.value = 'Email inválido';
    } else if (err.code === 'auth/weak-password') {
      error.value = 'La contraseña es muy débil';
    } else if (err.code === 'permission-denied' || err.message?.includes('permissions')) {
      error.value = 'Error de permisos. Verifica las reglas de Firestore en Firebase Console.';
    } else {
      error.value = err.message || 'Error al crear la cuenta. Intenta nuevamente.';
    }
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100%;
  padding: 32px;
}

.register-form {
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


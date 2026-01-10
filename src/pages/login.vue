<template>
  <f7-page name="login">
    <f7-navbar title="Iniciar Sesión" />
    <f7-block strong inset style="padding-top: 2rem;">
      <div style="max-width: 400px; margin: 0 auto; padding: 0 1rem;">
        <!-- Logo o título -->
        <h1 style="text-align: center; margin-bottom: 2rem; margin-top: 0; color: var(--vitta-primary, #007aff);">
          {{ tenantName }}
        </h1>

        <!-- Error message -->
        <f7-block v-if="errorMessage" style="margin-bottom: 1rem; padding: 0.75rem; background-color: #ffebee; border-radius: 8px;">
          <p style="color: #ff3b30; font-size: 0.9rem; margin: 0;">
            {{ errorMessage }}
          </p>
        </f7-block>

        <!-- Google Sign In -->
        <f7-button
          large
          fill
          @click="handleGoogleSignIn"
          :disabled="loading"
          style="margin-bottom: 1.5rem; width: 100%; background-color: var(--vitta-primary, #007aff); color: white;"
        >
          <f7-icon material="" style="margin-right: 0.5rem;"></f7-icon>
          Continuar con Google
        </f7-button>

        <!-- Divider -->
        <div style="text-align: center; margin: 1.5rem 0; color: #8e8e93;">
          <span>o</span>
        </div>

        <!-- Email/Password Form -->
        <f7-list no-hairlines-md>
          <f7-list-input
            label="Email"
            type="email"
            placeholder="tu@email.com"
            v-model:value="email"
            :disabled="loading"
          />
          <f7-list-input
            label="Contraseña"
            type="password"
            placeholder="••••••••"
            v-model:value="password"
            :disabled="loading"
          />
        </f7-list>

        <!-- Sign In / Sign Up buttons -->
        <f7-button
          large
          fill
          @click="handleEmailSignIn"
          :disabled="loading || !email || !password"
          style="margin-top: 1rem; margin-bottom: 0.5rem; width: 100%; background-color: var(--vitta-primary, #007aff); color: white;"
        >
          Ingresar
        </f7-button>

        <f7-button
          large
          outline
          @click="handleEmailSignUp"
          :disabled="loading || !email || !password"
          style="width: 100%; border-color: var(--vitta-primary, #007aff); color: var(--vitta-primary, #007aff);"
        >
          Crear cuenta
        </f7-button>
      </div>
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { f7 } from 'framework7-vue';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../auth/auth';
import { getCurrentUser, requireAuthReady } from '../auth/session';
import { getTenantIdFromPath } from '../tenant/tenant';
import { loadAndApplyTheme } from '../branding/branding';

const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');
const tenantName = ref('Vitta');
const tenantId = ref<string | null>(null);

const getErrorMessage = (error: any): string => {
  const code = error?.code || '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Credenciales inválidas. Verifica tu email y contraseña.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'Este email ya está registrado. Intenta iniciar sesión.';
  }
  if (code === 'auth/weak-password') {
    return 'La contraseña es muy débil. Usa al menos 6 caracteres.';
  }
  if (code === 'auth/invalid-email') {
    return 'El email no es válido.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'La ventana de Google fue cerrada. Intenta de nuevo.';
  }
  return error?.message || 'Ocurrió un error. Intenta de nuevo.';
};

const handleGoogleSignIn = async () => {
  console.log('Google sign in clicked');
  loading.value = true;
  errorMessage.value = '';
  try {
    console.log('Calling signInWithGoogle...');
    await signInWithGoogle();
    console.log('Google sign in successful');
    redirectAfterLogin();
  } catch (error: any) {
    console.error('Google sign in error:', error);
    errorMessage.value = getErrorMessage(error);
  } finally {
    loading.value = false;
  }
};

const handleEmailSignIn = async () => {
  console.log('Email sign in clicked', { email: email.value, password: password.value ? '***' : '' });
  if (!email.value || !password.value) {
    console.log('Email or password missing');
    return;
  }
  
  loading.value = true;
  errorMessage.value = '';
  try {
    console.log('Calling signInWithEmail...');
    await signInWithEmail(email.value, password.value);
    console.log('Email sign in successful');
    redirectAfterLogin();
  } catch (error: any) {
    console.error('Email sign in error:', error);
    errorMessage.value = getErrorMessage(error);
  } finally {
    loading.value = false;
  }
};

const handleEmailSignUp = async () => {
  if (!email.value || !password.value) return;
  
  loading.value = true;
  errorMessage.value = '';
  try {
    await signUpWithEmail(email.value, password.value);
    redirectAfterLogin();
  } catch (error: any) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    loading.value = false;
  }
};

const redirectAfterLogin = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const redirect = urlParams.get('redirect');
  
  let targetPath: string;
  
  if (redirect) {
    targetPath = decodeURIComponent(redirect);
    // Asegurar slash final
    if (!targetPath.endsWith('/') && targetPath !== '/') {
      targetPath += '/';
    }
  } else if (tenantId.value) {
    targetPath = `/t/${tenantId.value}/book/`;
  } else {
    targetPath = '/';
  }
  
  f7.views.main.router.navigate(targetPath);
};

onMounted(async () => {
  console.log('Login page mounted');
  
  // Detectar tenantId de la ruta
  const currentPath = window.location.pathname;
  tenantId.value = getTenantIdFromPath(currentPath);
  
  // Cargar y aplicar branding si hay tenant
  if (tenantId.value) {
    try {
      const theme = await loadAndApplyTheme(tenantId.value);
      tenantName.value = theme.name;
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  }
  
  try {
    // Esperar a que la sesión esté lista antes de verificar
    await requireAuthReady();
    console.log('Auth ready, checking user...');
    
    // Si ya está logueado, redirigir después de un pequeño delay
    const user = getCurrentUser();
    console.log('Current user:', user ? user.email : 'null');
    if (user) {
      setTimeout(() => {
        redirectAfterLogin();
      }, 100);
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
    // Continuar mostrando la página de login aunque haya error
  }
});
</script>


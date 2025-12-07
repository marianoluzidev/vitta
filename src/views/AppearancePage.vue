<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
        <IonButtons slot="start">
          <IonMenuButton menu="main-menu"></IonMenuButton>
        </IonButtons>
        <IonTitle>Apariencia</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <IonList>
        <IonRadioGroup :value="currentTheme" @ionChange="onThemeChange">
          <IonItem v-for="(value, key) in themes" :key="key">
            <IonLabel>{{ labelForTheme(key) }}</IonLabel>
            <IonRadio slot="end" :value="key" />
          </IonItem>
        </IonRadioGroup>
      </IonList>

      <!-- Ajuste fino de colores para tema custom -->
      <div v-if="themeMode === 'custom-logo' && !hasCustomTheme" class="custom-theme-note">
        <IonNote color="medium">
          Primero debes generar un tema desde el logo en "Tema desde logo"
        </IonNote>
      </div>

      <IonList v-if="hasCustomTheme && themeMode === 'custom-logo'">
        <IonItem lines="full">
          <IonLabel>
            <h3>Ajuste fino de colores</h3>
            <p>Personaliza los colores de tu tema</p>
          </IonLabel>
        </IonItem>
        
        <div class="color-picker-item">
          <IonLabel class="color-picker-label">
            <h3>Color primario</h3>
          </IonLabel>
          <div class="color-picker-wrapper">
            <ColorPicker v-model="editablePrimary" />
          </div>
        </div>
        
        <div class="color-picker-item">
          <IonLabel class="color-picker-label">
            <h3>Color secundario</h3>
          </IonLabel>
          <div class="color-picker-wrapper">
            <ColorPicker v-model="editableSecondary" />
          </div>
        </div>
        
        <div class="color-picker-item">
          <IonLabel class="color-picker-label">
            <h3>Fondo</h3>
          </IonLabel>
          <div class="color-picker-wrapper">
            <ColorPicker v-model="editableBackground" />
          </div>
        </div>
        
        <div class="color-picker-item">
          <IonLabel class="color-picker-label">
            <h3>Texto</h3>
          </IonLabel>
          <div class="color-picker-wrapper">
            <ColorPicker v-model="editableText" />
          </div>
        </div>

        <div class="custom-theme-actions">
          <IonButton 
            expand="block" 
            :disabled="savingCustomTheme" 
            @click="saveEditableTheme"
          >
            {{ savingCustomTheme ? 'Guardando...' : 'Guardar cambios de tema' }}
          </IonButton>
        </div>
      </IonList>
    </IonContent>
  </IonPage>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonRadioGroup,
  IonRadio,
  IonMenuButton,
  IonButtons,
  IonButton,
  IonNote,
} from '@ionic/vue'
import { themes } from '@/theme/themes'
import { applyTheme, applyThemeDefinition, type ThemeDefinition } from '@/theme/applyTheme'
import { lightenColor, darkenColor } from '@/theme/utils'
import { auth, db } from '@/firebase/app'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import ColorPicker from '@/components/ColorPicker.vue'

const currentTheme = ref<keyof typeof themes>('vitta')
const salonId = ref<string>('')
const themeMode = ref<'preset' | 'custom-logo'>('preset')

// Refs para ajuste fino de colores
const editablePrimary = ref('#08b8a4')
const editableSecondary = ref('#006d5f')
const editableBackground = ref('#ffffff')
const editableText = ref('#222222')
const hasCustomTheme = ref(false)
const currentCustomTheme = ref<ThemeDefinition | null>(null)
const savingCustomTheme = ref(false)

onMounted(() => {
  // Load theme from localStorage first (fallback)
  const savedTheme = localStorage.getItem('theme')
  const savedCustomTheme = localStorage.getItem('customTheme')
  
  if (savedTheme === 'custom-logo' && savedCustomTheme) {
    try {
      const customTheme = JSON.parse(savedCustomTheme) as ThemeDefinition
      currentCustomTheme.value = customTheme
      hasCustomTheme.value = true
      themeMode.value = 'custom-logo'
      
      // Initialize editable colors from saved customTheme
      editablePrimary.value = customTheme['--ion-color-primary'] ?? '#08b8a4'
      editableSecondary.value = customTheme['--ion-color-secondary'] ?? editablePrimary.value
      editableBackground.value = customTheme['--ion-background-color'] ?? '#ffffff'
      editableText.value = customTheme['--ion-text-color'] ?? '#222222'
    } catch (error) {
      console.error('Error parsing saved custom theme:', error)
    }
  } else if (savedTheme && savedTheme in themes) {
    currentTheme.value = savedTheme as keyof typeof themes
    themeMode.value = 'preset'
  }

  // Load salon ID
  onAuthStateChanged(auth, async (user) => {
    if (!user) return

    try {
      const salonsRef = collection(db, 'salons')
      const q = query(salonsRef, where('ownerId', '==', user.uid))
      const querySnapshot = await getDocs(q)

      if (!querySnapshot.empty) {
        const salonDoc = querySnapshot.docs[0]
        salonId.value = salonDoc.id

        // Load theme from Firestore if available
        const salonData = salonDoc.data()
        // If customTheme exists, load it for fine-tuning
        if (salonData.customTheme && typeof salonData.customTheme === 'object') {
          const customTheme = salonData.customTheme as ThemeDefinition
          currentCustomTheme.value = customTheme
          hasCustomTheme.value = true
          themeMode.value = 'custom-logo'
          
          // Initialize editable colors from customTheme
          editablePrimary.value = customTheme['--ion-color-primary'] ?? '#08b8a4'
          editableSecondary.value = customTheme['--ion-color-secondary'] ?? editablePrimary.value
          editableBackground.value = customTheme['--ion-background-color'] ?? '#ffffff'
          editableText.value = customTheme['--ion-text-color'] ?? '#222222'
        } else if (salonData.theme && salonData.theme in themes) {
          const theme = salonData.theme as keyof typeof themes
          currentTheme.value = theme
          themeMode.value = 'preset'
          applyTheme(theme)
          localStorage.setItem('theme', theme)
        }
      }
    } catch (error) {
      console.error('Error loading salon:', error)
    }
  })
})

async function onThemeChange(ev: CustomEvent) {
  const newTheme = ev.detail.value as keyof typeof themes
  if (!newTheme || !themes[newTheme]) return

  currentTheme.value = newTheme
  themeMode.value = 'preset'
  hasCustomTheme.value = false
  currentCustomTheme.value = null
  applyTheme(newTheme)
  localStorage.setItem('theme', newTheme)

  // Update theme in Firestore
  if (salonId.value) {
    try {
      const salonDoc = doc(db, 'salons', salonId.value)
      // Clear customTheme when switching to predefined theme
      await updateDoc(salonDoc, {
        theme: newTheme,
        customTheme: null,
      })
      // Clear customTheme and themeSource from localStorage
      localStorage.removeItem('customTheme')
      localStorage.removeItem('themeSource')
    } catch (error) {
      console.error('Error updating theme in Firestore:', error)
    }
  }
}

// Helper functions for color manipulation (using existing utils)
function lighten(color: string, percent: number): string {
  return lightenColor(color, percent)
}

function darken(color: string, percent: number): string {
  return darkenColor(color, percent)
}

// Build ThemeDefinition from editable colors
function buildThemeFromEditable(): ThemeDefinition {
  const primary = editablePrimary.value
  const secondary = editableSecondary.value
  const background = editableBackground.value
  const text = editableText.value

  return {
    '--ion-color-primary': primary,
    '--ion-color-primary-contrast': '#ffffff',
    '--ion-color-primary-shade': darken(primary, 0.15),
    '--ion-color-primary-tint': lighten(primary, 0.15),

    '--ion-color-secondary': secondary,
    '--ion-color-secondary-contrast': '#ffffff',
    '--ion-color-secondary-shade': darken(secondary, 0.15),
    '--ion-color-secondary-tint': lighten(secondary, 0.15),

    '--ion-background-color': background,
    '--background': background,
    '--ion-text-color': text,

    '--ion-toolbar-background': primary,
    '--ion-toolbar-color': '#ffffff',

    '--ion-tab-bar-background': '#ffffff',
    '--ion-tab-bar-color': primary,

    '--ion-item-background': '#ffffff',
    '--ion-card-background': '#ffffff',
  }
}

// Preview theme changes in real-time
function previewEditableTheme() {
  if (themeMode.value !== 'custom-logo') return
  const theme = buildThemeFromEditable()
  applyThemeDefinition(theme)
}

// Watch for color changes to preview in real-time
watch([editablePrimary, editableSecondary, editableBackground, editableText], () => {
  if (themeMode.value === 'custom-logo' && hasCustomTheme.value) {
    previewEditableTheme()
  }
})

// Save edited theme to Firestore
async function saveEditableTheme() {
  if (!salonId.value) return
  
  savingCustomTheme.value = true
  try {
    const theme = buildThemeFromEditable()
    applyThemeDefinition(theme)
    
    const salonRef = doc(db, 'salons', salonId.value)
    await updateDoc(salonRef, {
      customTheme: theme,
      theme: 'custom-logo',
    })
    
    currentCustomTheme.value = theme
    localStorage.setItem('theme', 'custom-logo')
    localStorage.setItem('customTheme', JSON.stringify(theme))
  } catch (error) {
    console.error('Error saving custom theme:', error)
  } finally {
    savingCustomTheme.value = false
  }
}

function labelForTheme(key: keyof typeof themes): string {
  if (key === 'vitta') return 'Vitta (verde, por defecto)'
  if (key === 'lavanda') return 'Lavanda'
  if (key === 'rosa') return 'Rosa Soft'
  if (key === 'dark') return 'Dark'
  if (key === 'aquaFull') return 'Verde completo (fondo)'
  return key
}
</script>

<style scoped>
.custom-theme-note {
  padding: 16px;
  margin-top: 16px;
}

.custom-theme-actions {
  padding: 16px;
}

.color-picker-item {
  margin-bottom: 24px;
  padding: 16px;
  background: var(--ion-item-background, #ffffff);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.color-picker-label {
  margin-bottom: 12px;
  display: block;
}

.color-picker-label h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ion-text-color);
}

.color-picker-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
  background: var(--ion-background-color, #ffffff);
  border-radius: 8px;
  padding: 8px;
}

.color-picker-wrapper :deep(.vitta-color-picker) {
  width: 100%;
  max-width: 100%;
  box-shadow: none;
}

.color-picker-wrapper :deep(.vc-chrome) {
  width: 100% !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12) !important;
  border-radius: 8px !important;
  overflow: hidden;
}

.color-picker-wrapper :deep(.vc-chrome-body) {
  padding: 12px !important;
}

.color-picker-wrapper :deep(.vc-chrome-saturation-wrap) {
  border-radius: 6px !important;
  overflow: hidden;
}
</style>


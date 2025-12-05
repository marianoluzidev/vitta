<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <!-- eslint-disable-next-line vue/no-deprecated-slot-attribute -->
        <IonButtons slot="start">
          <IonMenuButton menu="main-menu"></IonMenuButton>
        </IonButtons>
        <IonTitle>Tema desde logo</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <div class="upload-section">
        <IonLabel>
          <h2>Seleccionar logo</h2>
        </IonLabel>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          @change="handleFileSelect"
          style="display: none"
        />
        <IonButton expand="block" @click="triggerFileInput">
          <IonIcon :icon="imageOutline" slot="start"></IonIcon>
          Elegir imagen
        </IonButton>
      </div>

      <!-- Preview image (hidden) -->
      <img
        v-if="imagePreview"
        ref="previewImage"
        :src="imagePreview"
        style="display: none"
        @load="onImageLoad"
      />

      <!-- Loading state -->
      <div v-if="extracting" class="loading-section">
        <IonSpinner></IonSpinner>
        <p>Extrayendo colores...</p>
      </div>

      <!-- Colors display -->
      <div v-if="extractedColors.length > 0" class="colors-section">
        <IonLabel>
          <h2>Colores extraídos</h2>
        </IonLabel>
        <div class="colors-grid">
          <div
            v-for="(color, index) in extractedColors"
            :key="index"
            class="color-box"
            :style="{ backgroundColor: color }"
            :title="color"
          ></div>
        </div>

        <IonButton
          expand="block"
          @click="applyExtractedTheme"
          :disabled="extractedColors.length < 2"
        >
          <IonIcon :icon="checkmarkCircleOutline" slot="start"></IonIcon>
          Aplicar como tema
        </IonButton>
      </div>
    </IonContent>
  </IonPage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonLabel,
  IonIcon,
  IonSpinner,
  IonMenuButton,
  IonButtons,
} from '@ionic/vue'
import { imageOutline, checkmarkCircleOutline } from 'ionicons/icons'
import ColorThief from 'colorthief'
import { applyThemeDefinition, type ThemeDefinition } from '@/theme/applyTheme'
import { darkenColor, lightenColor, getContrastColor } from '@/theme/utils'
import { auth, db } from '@/firebase/app'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

const fileInput = ref<HTMLInputElement | null>(null)
const previewImage = ref<HTMLImageElement | null>(null)
const imagePreview = ref<string>('')
const extractedColors = ref<string[]>([])
const extracting = ref(false)
const salonId = ref<string>('')

onMounted(() => {
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
      }
    } catch (error) {
      console.error('Error loading salon:', error)
    }
  })
})

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  // Create preview
  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

function onImageLoad() {
  if (!previewImage.value) return

  extracting.value = true
  extractedColors.value = []

  try {
    const colorThief = new ColorThief()
    const palette = colorThief.getPalette(previewImage.value, 5) // 5 colores principales
    const hexColors = palette.map((rgb: number[]) => {
      const [r, g, b] = rgb
      return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
    })
    extractedColors.value = hexColors
  } catch (error) {
    console.error('Error extracting colors:', error)
  } finally {
    extracting.value = false
  }
}

async function applyExtractedTheme() {
  if (extractedColors.value.length < 2) return

  const primaryColor = extractedColors.value[0]
  const secondaryColor = extractedColors.value[1]
  const background = '#ffffff'
  const textColor = '#222222'

  // Create complete theme definition
  const newTheme: ThemeDefinition = {
    '--ion-color-primary': primaryColor,
    '--ion-color-primary-contrast': getContrastColor(primaryColor),
    '--ion-color-primary-shade': darkenColor(primaryColor, 0.15),
    '--ion-color-primary-tint': lightenColor(primaryColor, 0.15),
    '--ion-color-secondary': secondaryColor,
    '--ion-color-secondary-contrast': getContrastColor(secondaryColor),
    '--ion-color-secondary-shade': darkenColor(secondaryColor, 0.15),
    '--ion-color-secondary-tint': lightenColor(secondaryColor, 0.15),
    '--ion-background-color': background,
    '--ion-text-color': textColor,
    '--ion-toolbar-background': primaryColor,
    '--ion-toolbar-color': getContrastColor(primaryColor),
    '--ion-tab-bar-background': background,
    '--ion-tab-bar-color': textColor,
    '--ion-item-background': background,
    '--ion-card-background': background,
  }

  // Apply theme
  applyThemeDefinition(newTheme)

  // Save to localStorage
  localStorage.setItem('theme', 'custom-logo')
  localStorage.setItem('customTheme', JSON.stringify(newTheme))

  // Save to Firestore
  if (salonId.value) {
    try {
      const salonDoc = doc(db, 'salons', salonId.value)
      await updateDoc(salonDoc, {
        customTheme: newTheme,
        theme: 'custom-logo',
      })
    } catch (error) {
      console.error('Error updating theme in Firestore:', error)
    }
  }
}
</script>

<style scoped>
.upload-section {
  margin-bottom: 24px;
}

.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px;
}

.colors-section {
  margin-top: 24px;
}

.colors-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 16px 0;
}

.color-box {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: transform 0.2s;
}

.color-box:hover {
  transform: scale(1.1);
}
</style>


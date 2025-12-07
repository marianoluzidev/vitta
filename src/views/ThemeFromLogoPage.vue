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
        <IonButton expand="block" @click="triggerFileInput" :disabled="uploadingLogo">
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

      <!-- Uploading logo state -->
      <div v-if="uploadingLogo" class="loading-section">
        <IonSpinner></IonSpinner>
        <p>Subiendo logo...</p>
      </div>

      <!-- Upload error -->
      <div v-if="uploadError" class="error-section">
        <IonNote color="danger">{{ uploadError }}</IonNote>
      </div>

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
          :disabled="!generatedTheme || uploadingLogo"
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
  IonNote,
} from '@ionic/vue'
import { imageOutline, checkmarkCircleOutline } from 'ionicons/icons'
import { applyThemeDefinition, type ThemeDefinition } from '@/theme/applyTheme'
import { generateFullThemeFromImage } from '@/theme/themeGenerator'
import { auth, db, storage } from '@/firebase/app'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { onAuthStateChanged } from 'firebase/auth'

const fileInput = ref<HTMLInputElement | null>(null)
const previewImage = ref<HTMLImageElement | null>(null)
const imagePreview = ref<string>('')
const extractedColors = ref<string[]>([])
const extracting = ref(false)
const salonId = ref<string | null>(null)
const generatedTheme = ref<ThemeDefinition | null>(null)
const uploadingLogo = ref(false)
const uploadError = ref<string | null>(null)
const selectedFile = ref<File | null>(null)

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
      } else {
        salonId.value = null
      }
    } catch (error) {
      console.error('Error loading salon:', error)
    }
  })
})

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  selectedFile.value = file

  // Upload logo to Firebase Storage first
  await onLogoFileSelected(file)

  // Create preview for theme generation
  const reader = new FileReader()
  reader.onload = (e) => {
    imagePreview.value = e.target?.result as string
  }
  reader.readAsDataURL(file)
}

async function onLogoFileSelected(file: File) {
  if (!salonId.value) {
    uploadError.value = 'No se encontró el salón asociado al usuario.'
    return
  }

  try {
    uploadingLogo.value = true
    uploadError.value = null

    // nombre de archivo: logo_{salonId}_{originalName}
    const safeName = file.name.replace(/\s+/g, '_')
    const path = `salons/${salonId.value}/logo_${salonId.value}_${safeName}`

    const fileRef = storageRef(storage, path)
    await uploadBytes(fileRef, file)
    const url = await getDownloadURL(fileRef)

    // actualizar logoUrl en el doc del salón
    const salonDocRef = doc(db, 'salons', salonId.value)
    await updateDoc(salonDocRef, {
      logoUrl: url,
    })

    console.log('Logo subido exitosamente:', url)
  } catch (err) {
    console.error('Error subiendo logo:', err)
    uploadError.value = 'Hubo un problema al subir el logo.'
  } finally {
    uploadingLogo.value = false
  }
}

async function onImageLoad() {
  if (!previewImage.value) return

  extracting.value = true
  extractedColors.value = []
  generatedTheme.value = null

  try {
    // Generate full theme using Vibrant.js
    const theme = await generateFullThemeFromImage(previewImage.value)
    generatedTheme.value = theme

    // Extract colors for display from the generated theme
    const colors = [
      theme['--ion-color-primary'],
      theme['--ion-color-secondary'],
      theme['--ion-background-color'],
      theme['--ion-toolbar-background'],
      theme['--ion-color-primary-tint'],
    ].filter(Boolean) as string[]

    extractedColors.value = colors
  } catch (error) {
    console.error('Error generating theme from image:', error)
    extracting.value = false
  } finally {
    extracting.value = false
  }
}

async function applyExtractedTheme() {
  if (!generatedTheme.value) return

  const newTheme = generatedTheme.value

  // Apply theme
  applyThemeDefinition(newTheme)

  // Save to localStorage
  localStorage.setItem('theme', 'custom-logo')
  localStorage.setItem('themeSource', 'logo')
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

.error-section {
  margin: 16px 0;
  padding: 12px;
  background-color: var(--ion-color-danger-tint);
  border-radius: 8px;
}
</style>


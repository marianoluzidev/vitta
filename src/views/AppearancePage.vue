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
  IonList,
  IonItem,
  IonLabel,
  IonRadioGroup,
  IonRadio,
  IonMenuButton,
  IonButtons,
} from '@ionic/vue'
import { themes } from '@/theme/themes'
import { applyTheme } from '@/theme/applyTheme'
import { auth, db } from '@/firebase/app'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

const currentTheme = ref<keyof typeof themes>('vitta')
const salonId = ref<string>('')

onMounted(() => {
  // Load theme from localStorage first (fallback)
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme && savedTheme in themes) {
    currentTheme.value = savedTheme as keyof typeof themes
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
        if (salonData.theme && salonData.theme in themes) {
          const theme = salonData.theme as keyof typeof themes
          currentTheme.value = theme
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
  applyTheme(newTheme)
  localStorage.setItem('theme', newTheme)

  // Update theme in Firestore
  if (salonId.value) {
    try {
      const salonDoc = doc(db, 'salons', salonId.value)
      await updateDoc(salonDoc, { theme: newTheme })
    } catch (error) {
      console.error('Error updating theme in Firestore:', error)
    }
  }
}

function labelForTheme(key: keyof typeof themes): string {
  if (key === 'vitta') return 'Vitta (verde, por defecto)'
  if (key === 'lavanda') return 'Lavanda'
  if (key === 'rosa') return 'Rosa Soft'
  if (key === 'dark') return 'Dark'
  return key
}
</script>


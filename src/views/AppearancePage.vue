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

const currentTheme = ref<keyof typeof themes>('vitta')

onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme && savedTheme in themes) {
    currentTheme.value = savedTheme as keyof typeof themes
  }
})

function onThemeChange(ev: CustomEvent) {
  const newTheme = ev.detail.value as keyof typeof themes
  if (!newTheme || !themes[newTheme]) return

  currentTheme.value = newTheme
  applyTheme(newTheme)
  localStorage.setItem('theme', newTheme)
}

function labelForTheme(key: keyof typeof themes): string {
  if (key === 'vitta') return 'Vitta (verde, por defecto)'
  if (key === 'lavanda') return 'Lavanda'
  if (key === 'rosa') return 'Rosa Soft'
  if (key === 'dark') return 'Dark'
  return key
}
</script>


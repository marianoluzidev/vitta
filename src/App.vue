<template>
  <IonApp>
    <IonMenu side="start" menu-id="main-menu" content-id="main-content">
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Menú</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonItem button @click="navigateTo('/agenda')">
            <template #start>
              <IonIcon :icon="calendarOutline"></IonIcon>
            </template>
            <IonLabel>Agenda</IonLabel>
          </IonItem>
          <IonItem button @click="navigateTo('/clients')">
            <template #start>
              <IonIcon :icon="peopleOutline"></IonIcon>
            </template>
            <IonLabel>Clientes</IonLabel>
          </IonItem>
          <IonItem button @click="navigateTo('/employees')">
            <template #start>
              <IonIcon :icon="briefcaseOutline"></IonIcon>
            </template>
            <IonLabel>Empleados</IonLabel>
          </IonItem>
          <IonItem button @click="navigateTo('/services')">
            <template #start>
              <IonIcon :icon="cutOutline"></IonIcon>
            </template>
            <IonLabel>Servicios</IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonMenu>

    <IonRouterOutlet id="main-content"></IonRouterOutlet>
  </IonApp>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { menuController } from '@ionic/vue'
import {
  IonApp,
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRouterOutlet,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
} from '@ionic/vue'
import {
  calendarOutline,
  peopleOutline,
  briefcaseOutline,
  cutOutline,
} from 'ionicons/icons'

const router = useRouter()

async function navigateTo(path: string) {
  await menuController.close('main-menu')
  router.push(path)
}
</script>

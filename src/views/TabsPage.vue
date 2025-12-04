<template>
  <IonTabs>
    <IonRouterOutlet />
    <IonTabBar slot="bottom">
      <IonTabButton @click="router.replace('/tabs/agenda')">
        <IonIcon :icon="calendarOutline" />
        <IonLabel>Agenda</IonLabel>
      </IonTabButton>

      <IonTabButton @click="router.replace('/tabs/clients')">
        <IonIcon :icon="peopleOutline" />
        <IonLabel>Clientes</IonLabel>
      </IonTabButton>

      <IonTabButton @click="router.replace('/tabs/employees')">
        <IonIcon :icon="briefcaseOutline" />
        <IonLabel>Empleados</IonLabel>
      </IonTabButton>

      <IonTabButton @click="router.replace('/tabs/services')">
        <IonIcon :icon="cutOutline" />
        <IonLabel>Servicios</IonLabel>
      </IonTabButton>

      <IonTabButton @click="router.replace('/tabs/more')">
        <IonIcon :icon="ellipsisHorizontalOutline" />
        <IonLabel>Más</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import {
  IonTabs,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
} from '@ionic/vue';
import {
  calendarOutline,
  peopleOutline,
  briefcaseOutline,
  cutOutline,
  ellipsisHorizontalOutline,
} from 'ionicons/icons';

const router = useRouter();
</script>


<template>
  <IonTabs>
    <IonRouterOutlet />
    <IonTabBar slot="bottom">
      <IonTabButton tab="agenda" href="/tabs/agenda">
        <IonIcon :icon="calendarOutline" />
        <IonLabel>Agenda</IonLabel>
      </IonTabButton>

      <IonTabButton tab="clients" href="/tabs/clients">
        <IonIcon :icon="peopleOutline" />
        <IonLabel>Clientes</IonLabel>
      </IonTabButton>

      <IonTabButton tab="employees" href="/tabs/employees">
        <IonIcon :icon="briefcaseOutline" />
        <IonLabel>Empleados</IonLabel>
      </IonTabButton>

      <IonTabButton tab="services" href="/tabs/services">
        <IonIcon :icon="cutOutline" />
        <IonLabel>Servicios</IonLabel>
      </IonTabButton>

      <IonTabButton tab="more" href="/tabs/more">
        <IonIcon :icon="ellipsisHorizontalOutline" />
        <IonLabel>Más</IonLabel>
      </IonTabButton>
    </IonTabBar>
  </IonTabs>
</template>

<script setup lang="ts">
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
</script>


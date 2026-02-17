<template>
  <f7-page name="home">
    <!-- Top Navbar -->
    <f7-navbar large>
      <f7-nav-title>Vitta</f7-nav-title>
      <f7-nav-title-large>Vitta</f7-nav-title-large>
    </f7-navbar>
    <!-- Toolbar-->
    <f7-toolbar bottom>
      <f7-link>Left Link</f7-link>
      <f7-link>Right Link</f7-link>
    </f7-toolbar>
    <!-- Page content-->
    <f7-block>
      <p>Here is your blank Framework7 app. Let's see what we have here.</p>
      <f7-button href="/login/" style="margin: 0.5rem 0; display: block;">Ir a Login (href)</f7-button>
      <f7-button @click="goToLogin" style="margin: 0.5rem 0; display: block;">Ir a Login (programático)</f7-button>
      <f7-button href="/t/test/book/" style="margin: 0.5rem 0; display: block;">Ir a Book (pública)</f7-button>
    </f7-block>

  </f7-page>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const goToLogin = () => {
  router.push('/controlPanel/login/');
};
</script>
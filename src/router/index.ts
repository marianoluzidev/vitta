import { createRouter, createWebHistory } from '@ionic/vue-router'

import HomePage from '@/views/HomePage.vue'
import ClientsPage from '@/views/ClientsPage.vue'
import EmployeesPage from '@/views/EmployeesPage.vue'
import ServicesPage from '@/views/ServicesPage.vue'

import OnboardingPage from '@/views/OnboardingPage.vue'
import LoginPage from '@/views/LoginPage.vue'
import RegisterOwnerPage from '@/views/RegisterOwnerPage.vue'

import CreateAppointmentPage from '@/views/CreateAppointmentPage.vue'
import AppointmentDetailsPage from '@/views/AppointmentDetailsPage.vue'
import EditAppointmentPage from '@/views/EditAppointmentPage.vue'

const routes = [
  // Entrada a la app
  {
    path: '/',
    redirect: '/onboarding',
  },
  {
    path: '/onboarding',
    component: OnboardingPage,
  },
  {
    path: '/login',
    component: LoginPage,
  },
  {
    path: '/register-owner',
    component: RegisterOwnerPage,
  },

  // Rutas principales con menú lateral
  {
    path: '/agenda',
    name: 'Agenda',
    component: HomePage,
  },
  {
    path: '/clients',
    name: 'Clients',
    component: ClientsPage,
  },
  {
    path: '/employees',
    name: 'Employees',
    component: EmployeesPage,
  },
  {
    path: '/services',
    name: 'Services',
    component: ServicesPage,
  },
  
  // Redirects legacy /tabs routes
  {
    path: '/tabs',
    redirect: '/agenda',
  },
  {
    path: '/tabs/agenda',
    redirect: '/agenda',
  },
  {
    path: '/tabs/clients',
    redirect: '/clients',
  },
  {
    path: '/tabs/employees',
    redirect: '/employees',
  },
  {
    path: '/tabs/services',
    redirect: '/services',
  },

  // Rutas que se abren "encima" de los tabs
  {
    path: '/appointments/new',
    component: CreateAppointmentPage,
  },
  {
    path: '/appointments/:id',
    component: AppointmentDetailsPage,
  },
  {
    path: '/appointments/:id/edit',
    component: EditAppointmentPage,
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

export default router

import { createRouter, createWebHistory } from '@ionic/vue-router';
import { RouteRecordRaw } from 'vue-router';


const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/onboarding'
  },
  {
    path: '/tabs',
    redirect: '/tabs/agenda'
  },
  {
    path: '/onboarding',
    name: 'Onboarding',
    component: () => import('@/views/OnboardingPage.vue')
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginPage.vue')
  },
  {
    path: '/register-owner',
    name: 'RegisterOwner',
    component: () => import('@/views/RegisterOwnerPage.vue')
  },
  {
    path: '/tabs',
    component: () => import('@/views/TabsPage.vue'),
    children: [
      {
        path: '',
        redirect: '/tabs/agenda'
      },
      {
        path: 'agenda',
        name: 'Agenda',
        component: () => import('@/views/HomePage.vue')
      },
      {
        path: 'clients',
        name: 'Clients',
        component: () => import('@/views/ClientsPage.vue')
      },
      {
        path: 'employees',
        name: 'Employees',
        component: () => import('@/views/EmployeesPage.vue')
      },
      {
        path: 'services',
        name: 'Services',
        component: () => import('@/views/ServicesPage.vue')
      },
      {
        path: 'more',
        name: 'More',
        component: () => import('@/views/MorePage.vue')
      }
    ]
  },
  // Legacy routes - redirect to tabs
  {
    path: '/home',
    redirect: '/tabs/agenda'
  },
  {
    path: '/employees',
    redirect: '/tabs/employees'
  },
  {
    path: '/services',
    redirect: '/tabs/services'
  },
  {
    path: '/clients',
    redirect: '/tabs/clients'
  },
  // Child routes (not in tabs)
  {
    path: '/employees/new',
    name: 'NewEmployee',
    component: () => import('@/views/NewEmployeePage.vue')
  },
  {
    path: '/employees/:id/edit',
    name: 'EditEmployee',
    component: () => import('@/views/EditEmployeePage.vue')
  },
  {
    path: '/services/new',
    name: 'NewService',
    component: () => import('@/views/NewServicePage.vue')
  },
  {
    path: '/services/:id/edit',
    name: 'EditService',
    component: () => import('@/views/EditServicePage.vue')
  },
  {
    path: '/appointments/new',
    name: 'CreateAppointment',
    component: () => import('@/views/CreateAppointmentPage.vue')
  },
  {
    path: '/appointments/:id',
    name: 'AppointmentDetails',
    component: () => import('@/views/AppointmentDetailsPage.vue')
  },
  {
    path: '/appointments/:id/edit',
    name: 'EditAppointment',
    component: () => import('@/views/EditAppointmentPage.vue')
  },
  {
    path: '/clients/new',
    name: 'NewClient',
    component: () => import('@/views/NewClientPage.vue')
  },
  {
    path: '/clients/:id/edit',
    name: 'EditClient',
    component: () => import('@/views/EditClientPage.vue')
  }

]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router

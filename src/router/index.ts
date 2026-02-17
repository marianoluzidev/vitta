import { createRouter, createWebHistory } from 'vue-router';
import LandingPage from '../pages/landing.vue';
import HomePage from '../pages/home.vue';
import ControlPanelIndex from '../pages/controlPanel/index.vue';
import ControlPanelLogin from '../pages/controlPanel/login.vue';
import ControlPanelTenantForm from '../pages/controlPanel/tenant-form.vue';
import TenantHomePage from '../pages/tenant/home.vue';
import AdminShellPage from '../pages/admin-shell.vue';
import BookPage from '../pages/book.vue';
import MyBookingsPage from '../pages/my-bookings.vue';
import StorePage from '../pages/store.vue';
import LoginPage from '../pages/login.vue';
import AccessDeniedPage from '../pages/access-denied.vue';
import TenantNotFoundPage from '../pages/tenant-not-found.vue';
import TenantDisabledPage from '../pages/tenant-disabled.vue';

import { requireAuth, requireOwner, requireTenant, requireTenantAndAuth } from './guards';

const routes = [
  {
    path: '/',
    name: 'landing',
    component: LandingPage,
  },
  {
    path: '/controlPanel/login/',
    name: 'control-panel-login',
    component: ControlPanelLogin,
  },
  {
    path: '/controlPanel/',
    name: 'control-panel',
    component: ControlPanelIndex,
    beforeEnter: requireOwner,
  },
  {
    path: '/controlPanel/tenant/new/',
    name: 'control-panel-tenant-new',
    component: ControlPanelTenantForm,
    beforeEnter: requireOwner,
  },
  {
    path: '/controlPanel/tenant/:tenantId/edit/',
    name: 'control-panel-tenant-edit',
    component: ControlPanelTenantForm,
    beforeEnter: requireOwner,
  },
  {
    path: '/t/:tenantId/',
    name: 'tenant-home',
    component: AdminShellPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/welcome/',
    name: 'tenant-welcome',
    component: TenantHomePage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/login/',
    name: 'tenant-login',
    component: LoginPage,
    beforeEnter: requireTenant,
  },
  {
    path: '/t/:tenantId/book/',
    name: 'tenant-book',
    component: BookPage,
    beforeEnter: requireTenant,
  },
  {
    path: '/t/:tenantId/my-bookings/',
    name: 'tenant-my-bookings',
    component: MyBookingsPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/store/',
    name: 'tenant-store',
    component: StorePage,
    beforeEnter: requireTenant,
  },
  {
    path: '/t/:tenantId/admin/',
    name: 'tenant-admin',
    redirect: { name: 'tenant-home' },
  },
  {
    path: '/t/:tenantId/admin/inicio/',
    name: 'tenant-admin-inicio',
    component: AdminShellPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/access-denied/',
    name: 'access-denied',
    component: AccessDeniedPage,
  },
  {
    path: '/tenant-not-found/',
    name: 'tenant-not-found',
    component: TenantNotFoundPage,
  },
  {
    path: '/tenant-disabled/',
    name: 'tenant-disabled',
    component: TenantDisabledPage,
  },
  // Catch all - redirect to home
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;


import { createRouter, createWebHistory } from 'vue-router';
import LandingPage from '../pages/landing.vue';
import HomePage from '../pages/home.vue';
import ControlPanelIndex from '../pages/controlPanel/index.vue';
import ControlPanelLogin from '../pages/controlPanel/login.vue';
import ControlPanelTenantForm from '../pages/controlPanel/tenant-form.vue';
import TenantHomePage from '../pages/tenant/home.vue';
import AdminShellPage from '../pages/admin-shell.vue';
import StaffListPage from '../pages/tenant/admin/staff.vue';
import StaffNewPage from '../pages/tenant/admin/staff-new.vue';
import StaffEditPage from '../pages/tenant/admin/staff-edit.vue';
import StaffAvailabilityPage from '../pages/tenant/admin/staff-availability.vue';
import ServicesListPage from '../pages/tenant/admin/services.vue';
import ServiceNewPage from '../pages/tenant/admin/services-new.vue';
import ServiceEditPage from '../pages/tenant/admin/services-edit.vue';
import BookingNewPage from '../pages/tenant/admin/booking-new.vue';
import BookingDetailPage from '../pages/tenant/admin/booking-detail.vue';
import ClientViewPage from '../pages/tenant/admin/client-view.vue';
import ClientDetailPage from '../pages/tenant/admin/client-detail.vue';
import ClientNewPage from '../pages/tenant/admin/client-new.vue';
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
    path: '/t/:tenantId/admin/staff/',
    name: 'tenant-admin-staff-list',
    component: StaffListPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/admin/staff/new/',
    name: 'tenant-admin-staff-new',
    component: StaffNewPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/admin/staff/:staffId/',
    name: 'tenant-admin-staff-edit',
    component: StaffEditPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/admin/staff/:staffId/availability/',
    name: 'tenant-admin-staff-availability',
    component: StaffAvailabilityPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/admin/services/',
    name: 'tenant-admin-services-list',
    component: ServicesListPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/admin/services/new/',
    name: 'tenant-admin-services-new',
    component: ServiceNewPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/admin/services/:serviceId/',
    name: 'tenant-admin-services-edit',
    component: ServiceEditPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/admin/agenda/new/',
    name: 'tenant-admin-agenda-booking-new',
    component: BookingNewPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/admin/agenda/booking/:bookingId/',
    name: 'tenant-admin-agenda-booking-detail',
    component: BookingDetailPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/admin/clientes/new/',
    name: 'tenant-admin-clientes-new',
    component: ClientNewPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/admin/clientes/:clientId/',
    name: 'tenant-admin-clientes-detail',
    component: ClientViewPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/admin/clientes/:clientId/editar/',
    name: 'tenant-admin-clientes-edit',
    component: ClientDetailPage,
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


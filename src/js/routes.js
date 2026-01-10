import HomePage from '../pages/home.vue';
import OwnerPage from '../pages/owner.vue';
import BookPage from '../pages/book.vue';
import ConfirmPage from '../pages/confirm.vue';
import MyBookingsPage from '../pages/my-bookings.vue';
import StorePage from '../pages/store.vue';
import AdminPage from '../pages/admin.vue';
import LoginPage from '../pages/login.vue';
import AccessDeniedPage from '../pages/access-denied.vue';
import TenantNotFoundPage from '../pages/tenant-not-found.vue';
import TenantDisabledPage from '../pages/tenant-disabled.vue';
import { requireAuth, requireOwner } from '../auth/guards';
import { requireTenant, requireTenantAndAuth } from '../tenant/tenantGuard';

var routes = [
  {
    path: '/',
    component: HomePage,
  },
  {
    path: '/login/',
    component: LoginPage,
  },
  {
    path: '/access-denied/',
    component: AccessDeniedPage,
  },
  {
    path: '/tenant-not-found/',
    component: TenantNotFoundPage,
  },
  {
    path: '/tenant-disabled/',
    component: TenantDisabledPage,
  },
  {
    path: '/owner/',
    component: OwnerPage,
    beforeEnter: requireOwner,
  },
  // Rutas de tenant (Framework7 maneja automáticamente con/sin slash con pushState: true)
  {
    path: '/t/:tenantId/',
    component: BookPage,
    beforeEnter: requireTenant,
  },
  {
    path: '/t/:tenantId/book/',
    component: BookPage,
    beforeEnter: requireTenant,
  },
  {
    path: '/t/:tenantId/confirm/',
    component: ConfirmPage,
    beforeEnter: requireTenant,
  },
  {
    path: '/t/:tenantId/my-bookings/',
    component: MyBookingsPage,
    beforeEnter: requireTenant,
  },
  {
    path: '/t/:tenantId/store/',
    component: StorePage,
    beforeEnter: requireTenant,
  },
  {
    path: '/t/:tenantId/admin/',
    component: AdminPage,
    beforeEnter: requireTenantAndAuth,
  },
  {
    path: '/t/:tenantId/login/',
    component: LoginPage,
    beforeEnter: requireTenant,
  },
];

export default routes;

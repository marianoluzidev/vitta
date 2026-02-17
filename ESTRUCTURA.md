# Vitta – Estructura y estado del proyecto

## Qué es Vitta

App **multitenant** para reservar turnos (peluquería / salón de belleza):

- **Panel de control (owner):** crea y edita tenants (salones).
- **Por tenant:** clientes reservan turnos; el administrador del salón define horarios y servicios.

---

## Estructura del proyecto

```
src/
├── js/app.js              # Entrada: Vue + F7 + Router + Firebase
├── css/
│   ├── app.css            # Estilos base + variables --vitta-* (carga después de F7)
│   └── icons.css
├── components/app.vue     # Raíz: f7-app > f7-view > f7-page > router-view
├── router/
│   ├── index.ts           # Rutas Vue Router (history)
│   └── guards.ts          # requireAuth, requireOwner, requireTenant, requireTenantAndAuth
├── auth/                  # Login, sesión, claims (owner vía Firestore)
├── firebase/
├── tenant/                # tenantService, tenantAdmin, tenantGuard
├── branding/branding.ts   # Tema por tenant (theme.json, tenant.css, manifest, iconos)
└── pages/
    ├── landing.vue
    ├── controlPanel/      # Login owner, listado tenants, formulario tenant
    ├── tenant/
    │   ├── home.vue       # Home del salón (logo, links Reservar / Mis reservas / Tienda)
    │   └── admin/         # Admin del tenant (vacío)
    ├── book.vue           # Página “Reservar turno” (solo título + logout)
    ├── login.vue          # Login cliente (por tenant)
    ├── my-bookings.vue    # Mis reservas (placeholder)
    ├── store.vue          # Tienda (placeholder)
    └── ...
```

**Orden de carga de estilos (importante):**

1. `framework7/css/bundle` (en app.js)
2. `icons.css` + `app.css` (en app.js)
3. En rutas de tenant: `loadAndApplyTheme(tenantId)` inyecta `<link>` a `public/branding/{tenantId}/tenant.css` (o default).

Las variables `--vitta-primary`, `--vitta-accent`, etc. se definen en `app.css` por defecto y se sobrescriben en `branding.ts` con `applyTheme()`. Los archivos en `public/branding/*/tenant.css` deben **usar** esas variables (o colores concretos con `!important` si hace falta), no redefinirlas en `:root`.

---

## Qué está resuelto

- Vue Router (history), rutas estables, refresh y URL directa.
- Control panel: login owner, listado tenants, crear/editar tenant (nombre, activar/desactivar).
- Por tenant: home con logo y links, login cliente, guards (tenant válido, usuario logueado).
- Branding por tenant: theme.json, tenant.css, manifest, iconos desde `public/branding/{tenantId}/`.
- Rutas: `/`, `/controlPanel/`, `/t/:tenantId/`, `/t/:tenantId/login/`, `/t/:tenantId/book/`, `/t/:tenantId/my-bookings/`, `/t/:tenantId/store/`, `/t/:tenantId/admin/`.

---

## Qué falta para el flujo “sencillo”

### 1. Admin del tenant (horarios y servicios)

- **Ruta:** `/t/:tenantId/admin/` (existe; la página está vacía).
- **Falta:**
  - En Firestore (o donde guardes datos por tenant): colección o subcolección de **servicios** (nombre, duración, precio opcional).
  - En Firestore: **horarios disponibles** (por día de la semana, franjas hora inicio–fin, o slots).
  - UI en `tenant/admin`: pantallas para dar de alta/editar servicios y horarios.

### 2. Página de reservas (clientes)

- **Ruta:** `/t/:tenantId/book/` (existe; solo muestra “Reservar turno” y logout).
- **Falta:**
  - Listar **servicios** del tenant (desde Firestore).
  - Elegir **fecha** y **hora** (según horarios/slots del tenant).
  - Crear la **reserva** (documento en Firestore: tenant, servicio, fecha, hora, usuario, estado).

### 3. Mis reservas

- **Ruta:** `/t/:tenantId/my-bookings/` (existe como placeholder).
- **Falta:** listar reservas del usuario logueado para ese tenant (lectura desde Firestore).

### 4. Datos en Firestore

Esquema mínimo sugerido:

- `tenants/{tenantId}` – ya existe (nombre, isActive, etc.).
- `tenants/{tenantId}/services/{serviceId}` – servicios del salón (nombre, duración, precio).
- `tenants/{tenantId}/availability` o `schedules` – horarios/slots disponibles.
- `tenants/{tenantId}/bookings/{bookingId}` – reservas (servicio, fecha, hora, userId, estado).

Reglas de seguridad: que cada tenant solo lea/escriba sus propios `services`, `availability` y `bookings`.

---

## Por qué los estilos “no pueden” o se ven mal

1. **Orden de carga:** Framework7 tiene mucha especificidad. Si el CSS del tenant se carga después y no usa clases propias (por ejemplo `.tenant-home`, `.tenant-book`) o `!important` donde compite con F7, F7 gana.
2. **Variables no definidas:** Si `applyTheme()` no se ejecuta antes de que se use el CSS del tenant (por ejemplo en la primera pintura), `var(--vitta-primary)` puede quedar vacío. En `app.css` ya hay valores por defecto en `:root` para que siempre haya algo.
3. **Clases en la página:** Las páginas que quieran usar el tema deben tener una clase común (por ejemplo `tenant-home`, `tenant-book`) y el CSS del tenant debe scopear a esa clase para no pintar el resto de la app.

**Cambios hechos en el código:**

- `app.css`: definición de `:root` con `--vitta-*` por defecto y reglas para `.tenant-home` y `.tenant-book` usando `var(--vitta-background)`.
- `book.vue`: añadida clase `tenant-book` al `f7-page`.
- `branding.ts`: quitado el hack de `display: none` en `applyTheme` que podía dar parpadeos.
- Rutas `my-bookings` y `store` registradas en el router para que los links del home no redirijan a `/`.

---

## Próximos pasos recomendados

1. **Firestore:** definir (e implementar) `services` y `availability` (y luego `bookings`) para un tenant.
2. **Admin tenant:** pantalla para ABM de servicios y de horarios/slots.
3. **Book:** pantalla para elegir servicio, fecha, hora y guardar reserva.
4. **My-bookings:** listado de reservas del usuario en ese tenant.

Si quieres, el siguiente paso puede ser solo el modelo de datos en Firestore (nombres de colecciones y campos) y las pantallas mínimas de admin (servicios + horarios) y de reserva (servicio + fecha + hora).

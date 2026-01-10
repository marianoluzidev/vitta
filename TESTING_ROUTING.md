# Pruebas de Routing - Checklist

## 1. Acceso Directo a URLs (Pegar en barra de direcciones y Enter)

### Rutas Públicas
- [SI] `http://localhost:5173/` → Debe cargar HomePage
- [NO] `http://localhost:5173/login` → Debe redirigir a `/login/` y cargar LoginPage
- [NO] `http://localhost:5173/login/` → Debe cargar LoginPage directamente

### Rutas de Tenant (requieren tenant existente en Firestore)
- [SI] `http://localhost:5173/t/demo` → Debe redirigir a `/t/demo/` y cargar BookPage (si tenant existe)
- [SI] `http://localhost:5173/t/demo/` → Debe cargar BookPage directamente
- [SI] `http://localhost:5173/t/demo/book` → Debe redirigir a `/t/demo/book/` y cargar BookPage
- [SI] `http://localhost:5173/t/demo/book/` → Debe cargar BookPage directamente
- [SI] `http://localhost:5173/t/demo/login` → Debe redirigir a `/t/demo/login/` y cargar LoginPage
- [SI] `http://localhost:5173/t/demo/login/` → Debe cargar LoginPage directamente

### Rutas de Error
- [ ] `http://localhost:5173/tenant-not-found` → Debe redirigir a `/tenant-not-found/`
- [ ] `http://localhost:5173/tenant-not-found/` → Debe cargar TenantNotFoundPage
- [ ] `http://localhost:5173/tenant-disabled` → Debe redirigir a `/tenant-disabled/`
- [ ] `http://localhost:5173/tenant-disabled/` → Debe cargar TenantDisabledPage
- [ ] `http://localhost:5173/access-denied` → Debe redirigir a `/access-denied/`
- [ ] `http://localhost:5173/access-denied/` → Debe cargar AccessDeniedPage

### Rutas Protegidas (sin autenticación)
- [ ] `http://localhost:5173/owner` → Debe redirigir a `/login/?redirect=...` (sin auth)
- [ ] `http://localhost:5173/owner/` → Debe redirigir a `/login/?redirect=...` (sin auth)
- [ ] `http://localhost:5173/t/demo/admin` → Debe redirigir a `/t/demo/login/?redirect=...` (sin auth)
- [ ] `http://localhost:5173/t/demo/admin/` → Debe redirigir a `/t/demo/login/?redirect=...` (sin auth)

## 2. Navegación con Links (href)

### Desde HomePage
- [ ] Click en "Ir a Login (href)" → Debe navegar a `/login/`
- [ ] Click en "Ir a Book (pública)" → Debe navegar a `/t/test/book/` (si tenant existe)

### Verificar que la URL cambia
- [ ] Después de cada click, verificar que la URL en la barra del navegador cambia correctamente
- [ ] Verificar que puedes usar el botón "Atrás" del navegador para volver

## 3. Navegación Programática

### Desde HomePage
- [ ] Click en "Ir a Login (programático)" → Debe navegar a `/login/`

### Desde Login (después de login exitoso)
- [ ] Login desde `/login/` → Debe redirigir a `/` (home)
- [ ] Login desde `/t/demo/login/` → Debe redirigir a `/t/demo/book/`
- [ ] Login con `?redirect=/owner/` → Debe redirigir a `/owner/` (si es owner)

### Desde BookPage
- [ ] Click en "Cerrar Sesión" → Debe redirigir a `/login/` o `/t/demo/login/` según el tenant

## 4. Guards de Tenant

### Tenant No Existente
- [ ] `http://localhost:5173/t/inexistente/` → Debe redirigir a `/tenant-not-found/`
- [ ] `http://localhost:5173/t/inexistente/book/` → Debe redirigir a `/tenant-not-found/`

### Tenant Deshabilitado (isActive: false)
- [ ] Crear tenant con `isActive: false` en Firestore
- [ ] `http://localhost:5173/t/[tenant-disabled]/` → Debe redirigir a `/tenant-disabled/`

### Tenant Válido
- [ ] Crear tenant con `isActive: true` en Firestore
- [ ] `http://localhost:5173/t/[tenant-valid]/` → Debe cargar BookPage correctamente

## 5. Guards de Autenticación

### Sin Autenticación
- [ ] Intentar acceder a `/owner/` → Debe redirigir a `/login/?redirect=...`
- [ ] Intentar acceder a `/t/demo/admin/` → Debe redirigir a `/t/demo/login/?redirect=...`

### Con Autenticación (pero sin ser owner)
- [ ] Login normal y acceder a `/owner/` → Debe redirigir a `/access-denied/`

### Con Autenticación y Owner
- [ ] Login con claim `owner: true` y acceder a `/owner/` → Debe cargar OwnerPage

## 6. Normalización de URLs

### Verificar que todas las URLs se normalizan a slash final
- [ ] Acceder a `/login` → URL debe cambiar a `/login/`
- [ ] Acceder a `/t/demo` → URL debe cambiar a `/t/demo/`
- [ ] Acceder a `/t/demo/book` → URL debe cambiar a `/t/demo/book/`
- [ ] La raíz `/` NO debe cambiar (debe quedarse como `/`)

## 7. Panel de Debug (solo en desarrollo)

### Verificar que el panel aparece
- [ ] En desarrollo, debe aparecer panel en esquina inferior derecha
- [ ] Panel debe mostrar:
  - `window.location.href`
  - `window.location.pathname`
  - `currentRoute` (de Framework7)
  - `app init count` (debe ser 1, si es mayor hay doble inicialización)

### Verificar que se actualiza
- [ ] Al navegar, los valores del panel deben actualizarse cada segundo
- [ ] `currentRoute` debe coincidir con la ruta actual

## 8. Refresh/Recarga de Página

### Verificar que funciona después de refresh
- [ ] Navegar a `/login/` → Refresh (F5) → Debe seguir en `/login/`
- [ ] Navegar a `/t/demo/book/` → Refresh (F5) → Debe seguir en `/t/demo/book/`
- [ ] Navegar a `/owner/` (con auth) → Refresh (F5) → Debe seguir en `/owner/`

## 9. Navegación con Botones Atrás/Adelante del Navegador

- [ ] Navegar: `/` → `/login/` → `/t/demo/book/`
- [ ] Click "Atrás" → Debe volver a `/login/`
- [ ] Click "Atrás" otra vez → Debe volver a `/`
- [ ] Click "Adelante" → Debe ir a `/login/` de nuevo

## 10. Casos Edge

### URLs con Query Params
- [ ] `http://localhost:5173/login/?redirect=/owner/` → Debe mantener el query param
- [ ] Después de login, debe redirigir a `/owner/` correctamente

### URLs con Hash
- [ ] `http://localhost:5173/#section` → Debe mantener el hash después de normalización

### Rutas Muy Largas
- [ ] Verificar que rutas largas funcionan correctamente

## Checklist Final

- [ ] Todas las URLs directas funcionan (con y sin slash final)
- [ ] Todos los links funcionan correctamente
- [ ] La URL siempre se actualiza en la barra del navegador
- [ ] Los guards funcionan correctamente (tenant, auth, owner)
- [ ] Las redirecciones funcionan correctamente
- [ ] El refresh mantiene la ruta actual
- [ ] El botón atrás/adelante del navegador funciona
- [ ] No hay comportamiento intermitente
- [ ] El panel de debug muestra información correcta (solo en dev)
- [ ] No hay errores en la consola relacionados con routing


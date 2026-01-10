# Tools

Scripts de utilidad para desarrollo local (no para producción).

## set-owner-claim.js

Script para setear el custom claim `{ owner: true }` a un usuario en Firebase Auth.

### Requisitos

1. **Service Account JSON**: Necesitas descargar el service account JSON desde Firebase Console:
   - Ve a Firebase Console → Project Settings → Service Accounts
   - Haz clic en "Generate new private key"
   - Guarda el archivo JSON en un lugar seguro (NO commitearlo)

2. **Variable de entorno**: Configura `GOOGLE_APPLICATION_CREDENTIALS` apuntando al archivo JSON:
   ```bash
   # Linux/Mac
   export GOOGLE_APPLICATION_CREDENTIALS="./path/to/service-account.json"
   
   # Windows (PowerShell)
   $env:GOOGLE_APPLICATION_CREDENTIALS="./path/to/service-account.json"
   
   # Windows (CMD)
   set GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account.json
   ```

### Uso

```bash
# Por email
node tools/set-owner-claim.js --email="usuario@example.com"

# Por UID
node tools/set-owner-claim.js --uid="abc123..."

# O usando el script de npm (editar el email en package.json primero)
npm run set:owner
```

### Notas

- El usuario debe **cerrar sesión y volver a iniciar sesión** para que los cambios surtan efecto
- Los custom claims se cachean en el token JWT del usuario
- El script verifica si el claim ya está seteado antes de intentar setearlo


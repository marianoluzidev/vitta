#!/usr/bin/env node

/**
 * Script para setear el custom claim { owner: true } a un usuario
 * 
 * Uso:
 *   node tools/set-owner-claim.js --email="usuario@example.com"
 *   node tools/set-owner-claim.js --uid="abc123..."
 * 
 * Requiere:
 *   - Variable de entorno GOOGLE_APPLICATION_CREDENTIALS apuntando al service account JSON
 *   - firebase-admin instalado
 */

const admin = require('firebase-admin');
const minimist = require('minimist');

// Parsear argumentos
const args = minimist(process.argv.slice(2));
const email = args.email;
const uid = args.uid;

// Validar que se proporcione email o uid
if (!email && !uid) {
  console.error('Error: Debes proporcionar --email o --uid');
  console.error('Uso: node tools/set-owner-claim.js --email="usuario@example.com"');
  console.error('   o: node tools/set-owner-claim.js --uid="abc123..."');
  process.exit(1);
}

// Verificar que GOOGLE_APPLICATION_CREDENTIALS esté configurado
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Error: La variable de entorno GOOGLE_APPLICATION_CREDENTIALS no está configurada');
  console.error('Configúrala apuntando a tu service account JSON:');
  console.error('  export GOOGLE_APPLICATION_CREDENTIALS="./path/to/service-account.json"');
  console.error('  (Windows: set GOOGLE_APPLICATION_CREDENTIALS=./path/to/service-account.json)');
  process.exit(1);
}

// Inicializar Firebase Admin (idempotente)
if (admin.apps.length === 0) {
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    console.log('✓ Firebase Admin inicializado correctamente');
  } catch (error) {
    console.error('Error inicializando Firebase Admin:', error.message);
    console.error('Verifica que GOOGLE_APPLICATION_CREDENTIALS apunte a un archivo JSON válido');
    process.exit(1);
  }
}

/**
 * Función principal
 */
async function setOwnerClaim() {
  try {
    let targetUid = uid;
    let targetEmail = email;

    // Si se proporcionó email, buscar el UID
    if (email && !uid) {
      console.log(`Buscando usuario con email: ${email}...`);
      try {
        const userRecord = await admin.auth().getUserByEmail(email);
        targetUid = userRecord.uid;
        targetEmail = userRecord.email;
        console.log(`✓ Usuario encontrado: ${targetEmail} (UID: ${targetUid})`);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          console.error(`Error: No se encontró un usuario con el email ${email}`);
        } else {
          console.error('Error buscando usuario:', error.message);
        }
        process.exit(1);
      }
    }

    // Si se proporcionó UID directamente, obtener información del usuario
    if (uid && !email) {
      try {
        const userRecord = await admin.auth().getUser(uid);
        targetEmail = userRecord.email || '(sin email)';
        console.log(`✓ Usuario encontrado: ${targetEmail} (UID: ${targetUid})`);
      } catch (error) {
        if (error.code === 'auth/user-not-found') {
          console.error(`Error: No se encontró un usuario con el UID ${uid}`);
        } else {
          console.error('Error obteniendo usuario:', error.message);
        }
        process.exit(1);
      }
    }

    // Verificar claims actuales
    const userRecord = await admin.auth().getUser(targetUid);
    const currentClaims = userRecord.customClaims || {};
    
    if (currentClaims.owner === true) {
      console.log(`⚠ El usuario ${targetEmail} (${targetUid}) ya tiene el claim owner=true`);
      console.log('No se realizaron cambios.');
      return;
    }

    // Setear el custom claim
    console.log(`Configurando custom claim { owner: true } para ${targetEmail}...`);
    await admin.auth().setCustomUserClaims(targetUid, { owner: true });

    // Verificar que se haya seteado correctamente
    const updatedUser = await admin.auth().getUser(targetUid);
    const updatedClaims = updatedUser.customClaims || {};

    if (updatedClaims.owner === true) {
      console.log('✓ Custom claim seteado exitosamente!');
      console.log(`  Email: ${targetEmail}`);
      console.log(`  UID: ${targetUid}`);
      console.log(`  Claims: ${JSON.stringify(updatedClaims, null, 2)}`);
      console.log('\n⚠ Nota: El usuario debe cerrar sesión y volver a iniciar sesión para que los cambios surtan efecto.');
    } else {
      console.error('Error: El claim no se pudo verificar después de setearlo');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error setando custom claim:', error.message);
    if (error.code) {
      console.error(`Código de error: ${error.code}`);
    }
    process.exit(1);
  }
}

// Ejecutar
setOwnerClaim()
  .then(() => {
    console.log('\n✓ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Error fatal:', error);
    process.exit(1);
  });


import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

/**
 * Inicializa Firebase de forma idempotente.
 * No reinicializa si ya existe una instancia.
 */
export function initFirebase(): void {
  // Si ya está inicializado, no hacer nada
  if (app) {
    return;
  }

  // Verificar si ya existe una app en getApps()
  const existingApps = getApps();
  if (existingApps.length > 0) {
    app = existingApps[0];
    auth = getAuth(app);
    db = getFirestore(app);
    return;
  }

  // Obtener variables de entorno
  const firebaseConfig = {
    apiKey: (import.meta.env as any).VITE_FIREBASE_API_KEY,
    authDomain: (import.meta.env as any).VITE_FIREBASE_AUTH_DOMAIN,
    projectId: (import.meta.env as any).VITE_FIREBASE_PROJECT_ID,
    storageBucket: (import.meta.env as any).VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: (import.meta.env as any).VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: (import.meta.env as any).VITE_FIREBASE_APP_ID,
  };

  // Validar que todas las variables estén presentes
  const requiredVars = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];

  const missingVars = requiredVars.filter(
    (key) => !firebaseConfig[key as keyof typeof firebaseConfig]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing Firebase environment variables: ${missingVars.join(', ')}`
    );
  }

  // Inicializar Firebase
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

/**
 * Obtiene la instancia de Firebase Auth.
 * Debe llamarse después de initFirebase().
 */
export function getAuthInstance(): Auth {
  if (!auth) {
    throw new Error('Firebase Auth not initialized. Call initFirebase() first.');
  }
  return auth;
}

/**
 * Obtiene la instancia de Firestore.
 * Debe llamarse después de initFirebase().
 */
export function getDbInstance(): Firestore {
  if (!db) {
    throw new Error('Firestore not initialized. Call initFirebase() first.');
  }
  return db;
}

// Exportar instancias directas para conveniencia
export { auth, db };


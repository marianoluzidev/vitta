import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { getAuthInstance } from '../firebase/firebase';

/**
 * Inicia sesión con Google usando popup
 */
export async function signInWithGoogle(): Promise<User> {
  const auth = getAuthInstance();
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

/**
 * Inicia sesión con email y contraseña
 */
export async function signInWithEmail(email: string, password: string): Promise<User> {
  const auth = getAuthInstance();
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

/**
 * Crea una cuenta nueva con email y contraseña
 */
export async function signUpWithEmail(email: string, password: string): Promise<User> {
  const auth = getAuthInstance();
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

/**
 * Cierra la sesión del usuario actual
 */
export async function signOutUser(): Promise<void> {
  const auth = getAuthInstance();
  await firebaseSignOut(auth);
}

/**
 * Wrapper de onAuthStateChanged para facilitar el uso
 */
export function onAuthChanged(callback: (user: User | null) => void): () => void {
  const auth = getAuthInstance();
  return onAuthStateChanged(auth, callback);
}


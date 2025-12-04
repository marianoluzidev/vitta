import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase/app';

export interface RegisterOwnerPayload {
  name: string; // owner name
  email: string;
  password: string;
  salonName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function registerOwner(payload: RegisterOwnerPayload): Promise<void> {
  // Create user with Firebase Auth
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    payload.email,
    payload.password
  );

  const userId = userCredential.user.uid;

  // Create salon document in Firestore
  await addDoc(collection(db, 'salons'), {
    name: payload.salonName,
    ownerId: userId,
    ownerName: payload.name,
    createdAt: serverTimestamp(),
    // Placeholder fields for future use
    employees: [],
    services: [],
    settings: {},
  });
}

export async function login(payload: LoginPayload): Promise<void> {
  await signInWithEmailAndPassword(auth, payload.email, payload.password);
}




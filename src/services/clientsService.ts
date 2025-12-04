import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '@/firebase/app';

export interface Client {
  id: string;
  salonId: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

export interface CreateClientPayload {
  salonId: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}

export async function getClientsBySalonId(salonId: string): Promise<Client[]> {
  const clientsRef = collection(db, 'clients');
  const q = query(
    clientsRef,
    where('salonId', '==', salonId),
    orderBy('name', 'asc')
  );
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Client[];
}

export async function createClient(payload: CreateClientPayload): Promise<void> {
  const clientsRef = collection(db, 'clients');
  await addDoc(clientsRef, {
    salonId: payload.salonId,
    name: payload.name,
    phone: payload.phone,
    email: payload.email || null,
    notes: payload.notes || null,
    createdAt: serverTimestamp(),
  });
}

export async function getClientById(id: string): Promise<Client | null> {
  const clientRef = doc(db, 'clients', id);
  const clientSnap = await getDoc(clientRef);

  if (!clientSnap.exists()) {
    return null;
  }

  return {
    id: clientSnap.id,
    ...clientSnap.data(),
  } as Client;
}

export async function updateClient(id: string, payload: Partial<CreateClientPayload>): Promise<void> {
  const clientRef = doc(db, 'clients', id);
  const updateData: any = {
    updatedAt: serverTimestamp(),
  };

  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.phone !== undefined) updateData.phone = payload.phone;
  if (payload.email !== undefined) updateData.email = payload.email || null;
  if (payload.notes !== undefined) updateData.notes = payload.notes || null;

  await updateDoc(clientRef, updateData);
}

export async function deleteClient(id: string): Promise<void> {
  const clientRef = doc(db, 'clients', id);
  await deleteDoc(clientRef);
}




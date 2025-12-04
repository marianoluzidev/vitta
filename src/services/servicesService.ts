import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/app';

export interface Service {
  id: string;
  salonId: string;
  name: string;
  duration: number;
  price: number;
}

export interface CreateServicePayload {
  salonId: string;
  name: string;
  duration: number;
  price: number;
}

export async function getServicesBySalonId(salonId: string): Promise<Service[]> {
  const servicesRef = collection(db, 'services');
  const q = query(servicesRef, where('salonId', '==', salonId));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Service[];
}

export async function getServiceById(id: string): Promise<Service | null> {
  const serviceRef = doc(db, 'services', id);
  const serviceSnap = await getDoc(serviceRef);

  if (!serviceSnap.exists()) {
    return null;
  }

  return {
    id: serviceSnap.id,
    ...serviceSnap.data(),
  } as Service;
}

export async function createService(payload: CreateServicePayload): Promise<void> {
  const servicesRef = collection(db, 'services');
  await addDoc(servicesRef, {
    salonId: payload.salonId,
    name: payload.name,
    duration: payload.duration,
    price: payload.price,
    createdAt: serverTimestamp(),
  });
}

export async function updateService(id: string, payload: Partial<CreateServicePayload>): Promise<void> {
  const serviceRef = doc(db, 'services', id);
  const updateData: any = {};

  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.duration !== undefined) updateData.duration = payload.duration;
  if (payload.price !== undefined) updateData.price = payload.price;

  await updateDoc(serviceRef, updateData);
}

export async function deleteService(id: string): Promise<void> {
  const serviceRef = doc(db, 'services', id);
  await deleteDoc(serviceRef);
}




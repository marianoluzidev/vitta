import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase/app';

export interface Employee {
  id: string;
  salonId: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

export interface CreateEmployeePayload {
  salonId: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

export async function getEmployeesBySalonId(salonId: string): Promise<Employee[]> {
  const employeesRef = collection(db, 'employees');
  const q = query(employeesRef, where('salonId', '==', salonId));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Employee[];
}

export async function createEmployee(payload: CreateEmployeePayload): Promise<void> {
  const employeesRef = collection(db, 'employees');
  await addDoc(employeesRef, {
    salonId: payload.salonId,
    name: payload.name,
    email: payload.email,
    phone: payload.phone || null,
    notes: payload.notes || null,
    createdAt: serverTimestamp(),
  });
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const employeeRef = doc(db, 'employees', id);
  const employeeSnap = await getDoc(employeeRef);

  if (!employeeSnap.exists()) {
    return null;
  }

  return {
    id: employeeSnap.id,
    ...employeeSnap.data(),
  } as Employee;
}

export async function updateEmployee(id: string, payload: Partial<CreateEmployeePayload>): Promise<void> {
  const employeeRef = doc(db, 'employees', id);
  const updateData: any = {};

  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.email !== undefined) updateData.email = payload.email;
  if (payload.phone !== undefined) updateData.phone = payload.phone || null;
  if (payload.notes !== undefined) updateData.notes = payload.notes || null;

  await updateDoc(employeeRef, updateData);
}

export async function deleteEmployee(id: string): Promise<void> {
  const employeeRef = doc(db, 'employees', id);
  await deleteDoc(employeeRef);
}


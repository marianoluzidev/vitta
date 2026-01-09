// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAp4wdB3D9EIbDzsGtEYpzvjvPwqou7yMs",
  authDomain: "vitta-69d8b.firebaseapp.com",
  projectId: "vitta-69d8b",
  storageBucket: "vitta-69d8b.firebasestorage.app",
  messagingSenderId: "440717168756",
  appId: "1:440717168756:web:023d0d49ddd0be7ea58121",
  measurementId: "G-H8Y6EZCFMB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

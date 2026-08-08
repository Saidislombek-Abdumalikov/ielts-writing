import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDWqeOfX1kK-yJMhH-l8B3g971JznaekbU",
  authDomain: "ielts-writing-75031.firebaseapp.com",
  projectId: "ielts-writing-75031",
  storageBucket: "ielts-writing-75031.firebasestorage.app",
  messagingSenderId: "732732246508",
  appId: "1:732732246508:web:7a32797d0e57762bcb98c9"
};

const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);

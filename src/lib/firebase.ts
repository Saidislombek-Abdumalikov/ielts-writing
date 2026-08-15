import { initializeApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDWqeOfX1kK-yJMhH-l8B3g971JznaekbU",
  authDomain: "ielts-writing-75031.firebaseapp.com",
  projectId: "ielts-writing-75031",
  storageBucket: "ielts-writing-75031.firebasestorage.app",
  messagingSenderId: "732732246508",
  appId: "1:732732246508:web:7a32797d0e57762bcb98c9"
};

export const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
export const storage = getStorage(app);

// Enable Firestore Offline Data Persistence
enableIndexedDbPersistence(firestore).catch((err) => {
  if (err.code === 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a time.
    console.warn('Firestore offline persistence warning: Multiple tabs open');
  } else if (err.code === 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    console.warn('Firestore offline persistence is not supported by browser');
  }
});

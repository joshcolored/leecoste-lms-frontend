import { initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

/* Firebase Config (from env) */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

/* Initialize App */
const app = initializeApp(firebaseConfig);

/* Auth */
export const auth = getAuth(app);

/* Firestore */
export const db = getFirestore(app);
/* DB */
export const rtdb = getDatabase(app);
/* Storage */
export const storage = getStorage(app);

/* Session-only persistence */
setPersistence(auth, browserSessionPersistence);


import { initializeApp } from "firebase/app";
import {
  browserSessionPersistence,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";



/* Firebase Config */
const firebaseConfig = {
  apiKey: "AIzaSyCPHj9Kj6QAq6MS-5zS68DG1iOTitfnYR8",
  authDomain: "authsytem-979f3.firebaseapp.com",
  projectId: "authsytem-979f3",
  storageBucket: "authsytem-979f3.firebasestorage.app", // ✅ fixed
  messagingSenderId: "318182159987",
  appId: "1:318182159987:web:274b77b7ec0cd4e2dedc06",
  databaseURL:"https://authsytem-979f3-default-rtdb.firebaseio.com"
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

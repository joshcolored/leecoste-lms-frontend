import { UAParser } from "ua-parser-js";
import CryptoJS from "crypto-js";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";

import type { User } from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  onSnapshot,
} from "firebase/firestore";

import { auth, db } from "../firebase";

/* 🔥 IMPORT YOUR API INSTANCE */
import api, { setToken } from "../api/axios";

/* ================= TYPES ================= */

export type UserRole = "admin" | "broker" | "client";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;

  login: (
    email: string,
    password: string,
    remember: boolean
  ) => Promise<void>;

  register: (
    email: string,
    password: string,
    role: UserRole
  ) => Promise<void>;

  logout: () => Promise<void>;

  loading: boolean;
}

/* ================= CONTEXT ================= */

const AuthContext = createContext<AuthContextType | null>(null);

/* ================= PROVIDER ================= */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const sessionUnsub = useRef<(() => void) | null>(null);

  /* ================= AUTH LISTENER ================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);

      if (sessionUnsub.current) {
        sessionUnsub.current();
        sessionUnsub.current = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));

        if (snap.exists()) {
          setRole(snap.data().role as UserRole);
        }

        setUser(firebaseUser);

        const local = localStorage.getItem("auth_session");

        if (local) {
          const { uid, sessionId } = JSON.parse(local);

          const sessionRef = doc(db, "users", uid, "sessions", sessionId);

          sessionUnsub.current = onSnapshot(sessionRef, (docSnap) => {
            if (!docSnap.exists() || docSnap.data()?.active === false) {
              localStorage.removeItem("auth_session");
              signOut(auth);
              setUser(null);
              setRole(null);
            }
          });
        }

      } catch (err) {
        console.error("Auth load error", err);
      }

      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (sessionUnsub.current) sessionUnsub.current();
    };
  }, []);

  /* ================= LOGIN ================= */

  const login = async (
    email: string,
    password: string,
    remember: boolean
  ) => {

    await setPersistence(
      auth,
      remember
        ? browserLocalPersistence
        : browserSessionPersistence
    );

    const cred = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (!cred.user.emailVerified) {
      await signOut(auth);
      throw new Error("Email not verified");
    }

    /* 🔥 CALL BACKEND LOGIN TO CREATE COOKIE */
    const res = await api.post("/login", {
      email,
      password,
    });

    setToken(res.data.accessToken);

    /* ================= CREATE SESSION ================= */

    const parser = new UAParser();
    const result = parser.getResult();

    const deviceInfo = {
      browser: result.browser.name || "Unknown",
      os: result.os.name || "Unknown",
      device: result.device.type || "Desktop",
    };

    const sessionId = CryptoJS.SHA1(
      cred.user.uid + Date.now().toString()
    ).toString();

    const sessionRef = doc(
      collection(db, "users", cred.user.uid, "sessions"),
      sessionId
    );

    await setDoc(sessionRef, {
      device: deviceInfo,
      loginAt: serverTimestamp(),
      active: true,
    });

    localStorage.setItem(
      "auth_session",
      JSON.stringify({
        uid: cred.user.uid,
        sessionId,
        remember,
        loginAt: Date.now(),
      })
    );
  };

  /* ================= REGISTER ================= */

  const register = async (
    email: string,
    password: string,
    role: UserRole
  ) => {

    const cred = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await setDoc(doc(db, "users", cred.user.uid), {
      email,
      role,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });

    await sendEmailVerification(cred.user);
    await signOut(auth);
  };

  /* ================= LOGOUT ================= */

  const logout = async () => {

    try {
      await api.post("/logout");
    } catch {}

    const session = localStorage.getItem("auth_session");

    if (session) {
      const data = JSON.parse(session);

      try {
        await deleteDoc(
          doc(
            db,
            "users",
            data.uid,
            "sessions",
            data.sessionId
          )
        );
      } catch {}
    }

    localStorage.removeItem("auth_session");

    await signOut(auth);

    setUser(null);
    setRole(null);
  };

  /* ================= PROVIDER ================= */

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        login,
        register,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ================= HOOK ================= */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}

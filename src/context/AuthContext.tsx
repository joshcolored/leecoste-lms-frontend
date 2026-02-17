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

const AuthContext = createContext<AuthContextType | null>(
  null
);

/* ================= PROVIDER ================= */

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  /* Session listener */
  const sessionUnsub = useRef<(() => void) | null>(
    null
  );

  /* ================= AUTH LISTENER ================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {

        setLoading(true);

        /* Cleanup old session listener */
        if (sessionUnsub.current) {
          sessionUnsub.current();
          sessionUnsub.current = null;
        }

        /* Not logged in */
        if (!firebaseUser) {
          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }

        try {
          /* Load profile */
          const snap = await getDoc(
            doc(db, "users", firebaseUser.uid)
          );

          if (snap.exists()) {
            setRole(snap.data().role as UserRole);
          } else {
            setRole(null);
          }

          setUser(firebaseUser);

          /* ================= SESSION WATCH ================= */

          const local =
            localStorage.getItem("auth_session");

          if (local) {

            const { uid, sessionId } =
              JSON.parse(local);

            const sessionRef = doc(
              db,
              "users",
              uid,
              "sessions",
              sessionId
            );

            sessionUnsub.current = onSnapshot(
              sessionRef,
              (docSnap) => {

                /* 🔴 SESSION DELETED */
                if (!docSnap.exists()) {

                  console.log("Session deleted remotely");

                  localStorage.removeItem("auth_session");

                  signOut(auth);

                  setUser(null);
                  setRole(null);

                  return;
                }

                const data = docSnap.data();

                /* 🔴 SESSION DISABLED */
                if (data.active === false) {

                  console.log("Session terminated remotely");

                  localStorage.removeItem("auth_session");

                  signOut(auth);

                  setUser(null);
                  setRole(null);
                }
              }
            );
          }

        } catch (err) {

          console.error("Auth load error", err);

          setUser(firebaseUser);
          setRole(null);
        }

        setLoading(false);
      }
    );

    return () => {

      unsubscribe();

      if (sessionUnsub.current) {
        sessionUnsub.current();
        sessionUnsub.current = null;
      }
    };
  }, []);

  /* ================= LOGIN ================= */

  const login = async (
    email: string,
    password: string,
    remember: boolean
  ) => {

    /* ================= SAFE PERSISTENCE ================= */

    try {
      await setPersistence(
        auth,
        remember
          ? browserLocalPersistence
          : browserSessionPersistence
      );
    } catch (err) {

      console.warn(
        "Persistence not supported, using default",
        err
      );

      // iOS fallback → continue without persistence
    }

    /* ================= LOGIN ================= */

    const cred = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (!cred.user.emailVerified) {
      await signOut(auth);
      throw new Error("Email not verified");
    }

    /* ================= DEVICE INFO ================= */

    const parser = new UAParser();
    const result = parser.getResult();

    const deviceInfo = {
      browser: result.browser.name || "Unknown",
      os: result.os.name || "Unknown",
      device: result.device.type || "Desktop",
    };

    // /* ================= CREATE SESSION ================= */

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

    /* ================= SAVE LOCAL ================= */

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

    const cred =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    await setDoc(
      doc(db, "users", cred.user.uid),
      {
        email,
        role,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      }
    );

    await sendEmailVerification(cred.user);

    await signOut(auth);
  };

  /* ================= LOGOUT ================= */

  /* ================= LOGOUT ================= */

  const logout = async () => {

    const session = localStorage.getItem("auth_session");

    if (session) {
      const data = JSON.parse(session);

      try {
        // ✅ DELETE SESSION DOCUMENT
        await deleteDoc(
          doc(
            db,
            "users",
            data.uid,
            "sessions",
            data.sessionId
          )
        );

        console.log("Session deleted:", data.sessionId);

      } catch (err) {
        console.warn("Failed to delete session:", err);
      }
    }

    // Clear local session
    localStorage.removeItem("auth_session");

    // Firebase logout
    await signOut(auth);

    // Reset state
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
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return ctx;
}

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
import type { User, UserCredential } from "firebase/auth";

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


interface UserProfile {
  name: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;

  login: (
    email: string,
    password: string,
    remember: boolean
  ) => Promise<void>;

  register: (
    email: string,
    password: string,
    role: UserRole,
    firstName: string,
    lastName: string
  ) => Promise<UserCredential>;

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
  const [profile, setProfile] = useState<UserProfile | null>(null);

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
            const data = snap.data();

            setProfile({
              name: data.name,
              role: data.role as UserRole,
            });

            setRole(data.role as UserRole);

          } else {
            setProfile(null);
            setRole(null);
          }

          setUser(firebaseUser);

          setUser(firebaseUser);


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

  const startSessionListener = (uid: string, sessionId: string) => {
    const sessionRef = doc(db, "users", uid, "sessions", sessionId);

    if (sessionUnsub.current) {
      sessionUnsub.current();
      sessionUnsub.current = null;
    }

    sessionUnsub.current = onSnapshot(sessionRef, (docSnap) => {
      if (!docSnap.exists()) {
        console.log("Session deleted remotely");

        localStorage.removeItem("auth_session");

        signOut(auth);

        setUser(null);
        setRole(null);
        return;
      }

      const data = docSnap.data();

      if (data?.active === false) {
        console.log("Session terminated remotely");

        localStorage.removeItem("auth_session");

        signOut(auth);

        setUser(null);
        setRole(null);
      }
    });
  };

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

    startSessionListener(cred.user.uid, sessionId);

  };

  /* ================= REGISTER ================= */

  const register = async (
    email: string,
    password: string,
    role: UserRole,
    firstName: string,
    lastName: string
  ) => {

    const cred =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    await setDoc(
      doc(db, "users", cred.user.uid),
      {
        email,
        role,
        name: `${trimmedFirst} ${trimmedLast}`,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      }
    );

    await sendEmailVerification(cred.user);

    await signOut(auth);

    return cred;
  };


  /* ================= LOGOUT ================= */

  const logout = async () => {
    try {
      if (sessionUnsub.current) {
        sessionUnsub.current();
        sessionUnsub.current = null;
      }
      const sessionRaw = localStorage.getItem("auth_session");
      const session = sessionRaw ? JSON.parse(sessionRaw) : null;

      // 🔥 1️⃣ Delete session FIRST (while authenticated)
      if (session?.uid && session?.sessionId) {
        await deleteDoc(
          doc(db, "users", session.uid, "sessions", session.sessionId)
        );
        console.log("Session deleted:", session.sessionId);
      }

      // 🔥 2️⃣ Then sign out
      await signOut(auth);

      // 🔥 3️⃣ Then clear localStorage
      localStorage.removeItem("auth_session");

      setUser(null);
      setRole(null);

    } catch (error) {
      console.error("Logout failed:", error);
    }
  };




  /* ================= PROVIDER ================= */

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
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

import { useEffect, useRef, useState } from "react";
import SettingsSkeleton from "../skeletons/SettingsSkeleton";
import { useAuth } from "../context/AuthContext";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeClosed } from "lucide-react";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateProfile,
} from "firebase/auth";

import {
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import useTheme from "../hooks/useTheme";
import { auth, db, storage } from "../firebase";

import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

import Cropper from "react-easy-crop";
import { setAppTitle } from "../utils/appTitle";

/* ================= TYPES ================= */

interface SessionItem {
  id: string;
  device: {
    browser: string;
    os: string;
    device: string;
  };
  createdAt: any;
  active: boolean;
}

/* ================= COMPONENT ================= */

export default function Settings() {
  const { user, profile, role } = useAuth();
  const [ripples, setRipples] = useState<
    { id: number; x: number; y: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [passwordScore, setPasswordScore] = useState(0);
  const [passwordError, setPasswordError] = useState(false);
  const { theme, setTheme, brandColor, setBrandColor } = useTheme();

  /* ================= COMPANY ================= */
  const companyId = "main-company";
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyImage, setCompanyImage] = useState<string | null>(null);
  const companyFileRef = useRef<HTMLInputElement>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const loadCompanyFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCompanyImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };




  const saveCompanyCrop = async () => {
    if (!companyImage || !area) return;

    const img = new Image();
    img.src = companyImage;
    await new Promise((r) => (img.onload = r));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    canvas.width = 256;
    canvas.height = 256;

    ctx.drawImage(
      img,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      256,
      256
    );

    canvas.toBlob((blob) => {
      if (blob) {
        setCompanyLogo(URL.createObjectURL(blob));
        setCompanyImage(null);
      }
    });
  };

  const saveCompanySettings = async () => {
    if (!companyName) {
      setToast({
        type: "error",
        message: "Company name is required.",
      });
      return;
    }

    try {
      setSavingCompany(true);
      let logoURL = null;

      // Upload logo if exists
      if (companyLogo) {
        const blob = await fetch(companyLogo).then((r) => r.blob());

        const logoRef = ref(
          storage,
          `logo/${companyId}.jpg`
        );

        await uploadBytes(logoRef, blob);

        logoURL = await getDownloadURL(logoRef);
      }

      // Save to separate collection
      await setDoc(
        doc(db, "companies", companyId),
        {
          name: companyName,
          logoURL: logoURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setSavingCompany(false);
      setToast({
        type: "success",
        message: "Company settings saved successfully. Please refresh to see changes.",
      });

    } catch (error) {
      setSavingCompany(false);
      setToast({
        type: "error",
        message: "Error saving company settings.",
      });
    }
  };


  /* ================= Notifications ================= */

  const defaultNotifications = {
    comments: { push: true, email: true, sms: false },
    tags: { push: true, email: false, sms: false },
    reminders: { push: false, email: false, sms: false },
    activity: { push: false, email: false, sms: false },
  };

  const [notifications, setNotifications] = useState(defaultNotifications);
  const [loaded, setLoaded] = useState(false);
  const [initialized, setInitialized] = useState(false);




  /* 🔥 LOAD FROM FIRESTORE */
  useEffect(() => {
    if (!user) return;

    const loadPreferences = async () => {
      const snap = await getDoc(
        doc(db, "users", user.uid, "preferences", "notifications")
      );

      if (snap.exists()) {
        setNotifications({
          ...defaultNotifications,
          ...snap.data(),
        });
      }

      setLoaded(true);
    };

    loadPreferences();
  }, [user]);

  /* 🔥 SAVE TO FIRESTORE (ONLY AFTER INITIAL LOAD) */
  useEffect(() => {
    if (!user || !loaded) return;

    if (!initialized) {
      setInitialized(true);
      return;
    }

    const savePreferences = async () => {
      await setDoc(
        doc(db, "users", user.uid, "preferences", "notifications"),
        notifications
      );
    };

    savePreferences();
  }, [notifications, user, loaded]);

  const toggleNotification = (
    section: keyof typeof notifications,
    type: "push" | "email" | "sms"
  ) => {
    setNotifications((prev) => {
      const currentValue = prev[section][type];

      return {
        ...prev,
        [section]: {
          ...prev[section],
          [type]: !currentValue,
          ...(type === "push"
            ? {
              email: !currentValue,
              sms: !currentValue,
            }
            : {}),
        },
      };
    });
  };





  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const loadCompany = async () => {
      const snap = await getDoc(doc(db, "companies", companyId));

      if (snap.exists()) {
        const data = snap.data();
        setCompanyName(data.name || "");
        setCompanyLogo(data.logoURL || null);
        setAppTitle(data.name || "");
      }
    };

    loadCompany();
  }, []);


  useEffect(() => {
    if (!user) return;

    const initialize = async () => {
      await loadSessions();
      setLoading(false);
    };

    initialize();
  }, [user]);


  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  /* Split displayName into first + last */
  useEffect(() => {
    if (profile?.name) {
      const parts = profile.name.trim().split(" ");
      setFirstName(parts[0] || "");
      setLastName(parts.slice(1).join(" ") || "");
    }
  }, [profile]);


  useEffect(() => {
    const combined = [firstName, lastName]
      .filter(Boolean)
      .join(" ");
    setName(combined);
  }, [firstName, lastName]);







  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadFile(e.dataTransfer.files[0]);
    }
  };


  /* Tabs */
  const [tab, setTab] =
    useState<"profile" | "password" | "appearance" | "notifications">("profile");


  const [photo, setPhoto] = useState<string | null>(
    null
  );

  const fileRef = useRef<HTMLInputElement>(null);

  /* Crop */
  const [image, setImage] = useState<string | null>(
    null
  );

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<any>(null);

  /* Sessions */
  const [sessions, setSessions] = useState<
    SessionItem[]
  >([]);

  const [currentSessionId, setCurrentSessionId] =
    useState<string | null>(null);

  /* Password */
  const [currentPass, setCurrentPass] =
    useState("");

  const [isUpdating, setIsUpdating] = useState(false);

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /* Confirm Modal */
  const [confirmId, setConfirmId] =
    useState<string | null>(null);

  /* ================= LOAD ================= */

  useEffect(() => {
    if (!user) return;

    const local = localStorage.getItem("auth_session");

    if (local) {
      const data = JSON.parse(local);
      setCurrentSessionId(data.sessionId);
    }

    loadSessions();
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;

    const snap = await getDocs(
      collection(db, "users", user.uid, "sessions")
    );

    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    // newest first
    list.sort(
      (a, b) =>
        b.createdAt?.seconds -
        a.createdAt?.seconds
    );

    setSessions(list);
  };

  /* ================= IMAGE ================= */

  const loadFile = (file: File) => {
    const reader = new FileReader();

    reader.onload = () => {
      setImage(reader.result as string);
    };

    reader.readAsDataURL(file);
  };

  const onCropComplete = (_: any, a: any) => {
    setArea(a);
  };

  const saveCrop = async () => {
    if (!image || !area) return;

    const img = new Image();
    img.src = image;

    await new Promise((r) => (img.onload = r));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    canvas.width = 256;
    canvas.height = 256;

    ctx.drawImage(
      img,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      256,
      256
    );

    canvas.toBlob((b) => {
      if (b) {
        setPhoto(URL.createObjectURL(b));
        setImage(null);
      }
    });
  };

  /* ================= PROFILE ================= */

  const saveProfile = async () => {
    if (!user) return;

    try {
      setSaving(true);

      let photoURL = user.photoURL;

      // 🔥 Upload new avatar if changed
      if (photo) {
        const blob = await fetch(photo).then((r) => r.blob());

        const imgRef = ref(
          storage,
          `users/${user.uid}/avatar.jpg`
        );

        await uploadBytes(imgRef, blob);
        photoURL = await getDownloadURL(imgRef);
      }

      // 🔥 1️⃣ Update Firestore (MAIN SOURCE OF TRUTH)
      await updateDoc(doc(db, "users", user.uid), {
        name: name.trim(),
        photoURL: photoURL || null,
        updatedAt: serverTimestamp(),
      });

      // 🔥 2️⃣ (Optional) Update Firebase Auth displayName for compatibility
      await updateProfile(auth.currentUser!, {
        displayName: name.trim(),
        photoURL,
      });

      setToast({
        type: "success",
        message: "Profile updated successfully.",
      });

    } catch (error) {
      console.error("Profile update failed:", error);

      setToast({
        type: "error",
        message: "Failed to update profile.",
      });

    } finally {
      setSaving(false);
    }
  };


  /* ================= PASSWORD ================= */
  useEffect(() => {
    const score = calculatePasswordStrength(newPass);
    setPasswordScore(score);
  }, [newPass]);

  const calculatePasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const savePassword = async () => {
    if (!user) return;


    if (newPass !== confirmPass) {
      setToast({
        type: "error",
        message: "Passwords do not match.",
      });
      return;
    }

    try {
      setIsUpdating(true);
      const cred = EmailAuthProvider.credential(
        user.email!,
        currentPass
      );

      await reauthenticateWithCredential(
        auth.currentUser!,
        cred
      );

      await updatePassword(
        auth.currentUser!,
        newPass
      );

      setToast({
        type: "success",
        message: "Password updated successfully.",
      });

      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");

    } catch (err) {
      setToast({
        type: "error",
        message: "Error updating password. Check your current password.",
      });
    }
    finally {
      setIsUpdating(false);
    }
  };

  /* ================= SESSION LOGOUT ================= */

  const confirmLogout = (id: string) => {
    setConfirmId(id);
  };

  const logoutSession = async () => {
    if (!user || !confirmId) return;

    try {
      setIsLoggingOut(true);
      await deleteDoc(
        doc(
          db,
          "users",
          user.uid,
          "sessions",
          confirmId
        )
      );

      setConfirmId(null);
      loadSessions();
    } finally {
      setIsLoggingOut(false);
    }
  };

  /* ================= UI ================= */
  if (loading) return <SettingsSkeleton />;
  if (!user) return null;


  const current = sessions.find(
    (s) => s.id === currentSessionId
  );

  const others = sessions.filter(
    (s) => s.id !== currentSessionId
  );

  return (
    <div className="min-h-screen scroll-smooth">

      {toast && (
        <div
          className={`
      fixed top-6 left-1/2 -translate-x-1/2 z-50
      px-6 py-3 rounded-lg shadow-lg text-center text-sm font-medium

      transition-all duration-300 ease-in-out

      ${toast.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
            }

      animate-toast
    `}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <h1 className="text-2xl font-bold dark:text-white">Settings</h1>

      {/* Tabs */}
      {/* ================= LIQUID SCROLLABLE TABS ================= */}

      <div className="relative mt-4 w-full overflow-x-auto scrollbar-hide">
        <div
          className="
      inline-flex min-w-max p-1 rounded-lg
      bg-white backdrop-blur-2xl
      border border-white/40 dark:bg-neutral-700 dark:border-gray-700/40
    "
        >
          {(["profile", "password", "appearance", "notifications"] as const).map((item) => (
            <button
              key={item}
              onClick={(e) => {
                setTab(item);

                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const newRipple = {
                  id: Date.now(),
                  x,
                  y,
                };

                setRipples((prev) => [...prev, newRipple]);

                setTimeout(() => {
                  setRipples((prev) =>
                    prev.filter((r) => r.id !== newRipple.id)
                  );
                }, 900);
              }}
              className="
          relative px-6 py-2 text-sm font-medium
          rounded-xl whitespace-nowrap flex-shrink-0
          overflow-hidden dark:text-gray-300
        "
            >
              {/* ===== ACTIVE LIQUID BACKGROUND ===== */}
              {tab === item && (
                <>
                  <motion.div
                    layoutId="liquid-tab"
                    className="
                absolute inset-0 rounded-xl
                bg-white/60 backdrop-blur-xl
                shadow-lg
              "
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 28,
                      mass: 0.8,
                    }}
                  />

                  <motion.div
                    layoutId="liquid-glow"
                    className="absolute -inset-3 rounded-2xl blur-2xl"
                    style={{
                      backgroundColor: brandColor,
                      opacity: 0.4,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 30,
                    }}
                  />

                </>
              )}

              {/* ===== RIPPLE EFFECTS ===== */}
              {tab === item &&
                ripples.map((ripple) => (
                  <div
                    key={ripple.id}
                    className="absolute pointer-events-none"
                    style={{
                      left: ripple.x,
                      top: ripple.y,
                    }}
                  >
                    {/* Ring 1 */}
                    <motion.span
                      className="absolute block rounded-full border border-white/70"
                      initial={{ scale: 0, opacity: 0.8 }}
                      animate={{ scale: 4, opacity: 0 }}
                      transition={{
                        duration: 0.8,
                        ease: "easeOut",
                      }}
                      style={{
                        width: 20,
                        height: 20,
                        marginLeft: -10,
                        marginTop: -10,
                      }}
                    />

                    {/* Ring 2 */}
                    <motion.span
                      className="absolute block rounded-full border border-white/50"
                      initial={{ scale: 0, opacity: 0.6 }}
                      animate={{ scale: 5.5, opacity: 0 }}
                      transition={{
                        duration: 1,
                        ease: "easeOut",
                        delay: 0.1,
                      }}
                      style={{
                        width: 20,
                        height: 20,
                        marginLeft: -10,
                        marginTop: -10,
                      }}
                    />

                    {/* Micro Particles */}
                    {[...Array(6)].map((_, i) => (
                      <motion.span
                        key={i}
                        className="absolute w-1 h-1 bg-white rounded-full"
                        initial={{ x: 0, y: 0, opacity: 1 }}
                        animate={{
                          x: Math.cos((i / 6) * 2 * Math.PI) * 25,
                          y: Math.sin((i / 6) * 2 * Math.PI) * 25,
                          opacity: 0,
                        }}
                        transition={{
                          duration: 0.6,
                          ease: "easeOut",
                        }}
                      />
                    ))}

                    {/* Shimmer Distortion */}
                    <motion.div
                      className="absolute rounded-full bg-white/30 blur-xl"
                      initial={{ scale: 0, opacity: 0.5 }}
                      animate={{ scale: 3, opacity: 0 }}
                      transition={{
                        duration: 0.6,
                        ease: "easeOut",
                      }}
                      style={{
                        width: 40,
                        height: 40,
                        marginLeft: -20,
                        marginTop: -20,
                      }}
                    />
                  </div>
                ))}

              {/* ===== TAB LABEL ===== */}
              <motion.span
                whileTap={{ scale: 0.92 }}
                animate={{
                  scale: tab === item ? 1.05 : 1,
                }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 25,
                }}
                className="relative z-10 transition-colors duration-300 dark:group-hover:text-gray-300"
                style={{
                  color: tab === item ? brandColor : undefined,
                }}
              >
                {item === "profile"
                  ? "Profile"
                  : item === "password"
                    ? "Password"
                    : item === "appearance"
                      ? "Appearance"
                      : "Notifications"}
              </motion.span>
            </button>
          ))}
        </div>
      </div>




      {/* ================= PROFILE ================= */}
      <AnimatePresence mode="wait">

        {tab === "profile" && (

          <motion.div
            key="profile"
            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <div className="bg-white rounded-xl p-6 mt-4 shadow dark:bg-neutral-800">

              <h2 className="font-semibold dark:text-gray-200 text-lg mb-4">
                Personal info
              </h2>


              <div className="flex flex-col items-center text-center gap-6 p-6 bg-gray-50 rounded-xl
                md:flex-row md:items-start md:text-left dark:bg-neutral-700/50">


                <div className="relative flex flex-col items-center">
                  {/* Avatar */}
                  <img
                    src={
                      photo ||
                      user.photoURL ||
                      `https://ui-avatars.com/api/?name=${name}`
                    }
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover"
                  />
                  <h3 className="text-sm text-gray-500 dark:text-gray-300 mt-2">
                    Profile photo
                  </h3>
                </div>
                {/* Upload Box */}
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className="
    flex flex-col items-center justify-center w-full max-w-md
    md:items-center md:text-center
    border rounded-xl px-10 py-8 cursor-pointer
    transition duration-200 ease-in-out dark:bg-neutral-900/50 dark:border-gray-900
  "
                  style={
                    dragActive
                      ? {
                        borderColor: brandColor,
                        backgroundColor: `${brandColor}15`, // soft tint
                      }
                      : {
                        borderColor: "#E5E7EB",
                      }
                  }
                  onMouseEnter={(e) => {
                    if (!dragActive) {
                      e.currentTarget.style.borderColor = brandColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!dragActive) {
                      e.currentTarget.style.borderColor = "#E5E7EB";
                    }
                  }}
                >

                  {/* Upload Icon */}
                  <div className="flex items-center justify-center w-10 h-10 mb-4
                    rounded-lg border border-gray-200 bg-gray-50 dark:bg-neutral-700 dark:border-gray-600">
                    <svg
                      className="w-5 h-5 text-gray-500 dark:text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 16V4m0 0l-4 4m4-4l4 4m6 8v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2"
                      />
                    </svg>
                  </div>

                  {/* Text */}
                  <p
                    className="text-sm font-medium dark:text-gray-300"
                    style={{ color: brandColor }}
                  >
                    Click to upload
                  </p>

                  <p className="text-sm text-gray-400 mt-1 text-center dark:text-gray-400">
                    or drag and drop
                  </p>
                  <p className="text-xs text-gray-400 mt-1 text-center dark:text-gray-400">
                    SVG, PNG, JPG or GIF (max. 800x400px)
                  </p>
                </div>

                {/* Hidden File Input */}
                <input
                  ref={fileRef}
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files && loadFile(e.target.files[0])
                  }
                />

              </div>


              <div className="bg-gray-50 p-6 mt-4 rounded-xl dark:bg-neutral-700/50">

                {/* Name */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                    Name <span style={{ color: brandColor }}>*</span>
                  </label>

                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = brandColor;
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${brandColor}40`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#D1D5DB";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      className="
    w-full rounded-lg border border-gray-300
    px-4 py-2.5 text-sm
    focus:outline-none
    bg-white transition
    dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-300
  "
                    />


                    <input
                      type="text"
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = brandColor;
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${brandColor}40`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#D1D5DB";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      className="
    w-full rounded-lg border border-gray-300
    px-4 py-2.5 text-sm
    focus:outline-none
    bg-white transition
    dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-300
  "
                    />


                  </div>
                </div>

                <hr className="my-6 border-gray-200" />

                {/* Email */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                      Email address <span style={{ color: brandColor }}>*</span>
                    </label>

                    <div className="relative">
                      {/* Icon */}
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16 12H8m8 0a4 4 0 10-8 0m8 0v4a4 4 0 01-8 0v-4"
                          />
                        </svg>
                      </div>

                      <input
                        type="email"
                        disabled
                        value={user.email || ""}
                        className="w-full rounded-lg border border-gray-300 
                   pl-10 pr-4 py-2.5 text-sm
                   bg-gray-100 text-gray-600
                   focus:outline-none dark:bg-neutral-700 dark:border-neutral-600 dark:text-gray-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                      Role
                    </label>

                    <div className="relative">
                      {/* Icon */}
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16 12H8m8 0a4 4 0 10-8 0m8 0v4a4 4 0 01-8 0v-4"
                          />
                        </svg>
                      </div>

                      <input
                        type="email"
                        disabled
                        value={role || ""}
                        className="w-full rounded-lg border border-gray-300 
                   pl-10 pr-4 py-2.5 text-sm
                   bg-gray-100 text-gray-600
                   focus:outline-none dark:bg-neutral-700 dark:border-neutral-600 dark:text-gray-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4">

                <button
                  onClick={saveProfile}
                  disabled={saving}
                  style={{ backgroundColor: brandColor }}
                  className="px-5 py-2 rounded-lg
           text-white font-medium
          hover:bg-gray-700 transition flex items-center gap-2
          disabled:opacity-50"
                >
                  {saving && (
                    <svg
                      className="w-4 h-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="white"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="white"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                  )}
                  {saving ? "Saving..." : "Save"}
                </button>

              </div>

            </div>

          </motion.div>
        )}

        {/* ================= PASSWORD ================= */}
        {tab === "password" && (
          <motion.div
            key="password"
            initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          >
            <div className="bg-white rounded-xl mt-4 shadow dark:bg-neutral-800">

              {/* Header */}
              <div className="p-6 dark:border-gray-700">
                <h2 className="text-lg font-semibold dark:text-white">Password</h2>
                <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                  Please enter your current password to change your password.
                </p>
              </div>

              {/* Current Password */}
              <div className="grid md:grid-cols-3 items-center px-6 py-6 gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current password <span style={{ color: brandColor }}>*</span>
                </label>

                <div className="md:col-span-2 relative md:w-2/3">
                  <input
                    type={showCurrent ? "text" : "password"}
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = brandColor;
                      e.currentTarget.style.boxShadow = `0 0 0 2px ${brandColor}40`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "#D1D5DB";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                    className="
    w-full rounded-lg border border-gray-300
    px-4 py-2.5 text-sm
    focus:outline-none
    transition
    dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-300
  "
                  />

                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  >
                    {showCurrent ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="grid md:grid-cols-3 items-center px-6 py-6 gap-4 dark:border-gray-700">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  New password <span style={{ color: brandColor }}>*</span>
                </label>

                <div className="md:col-span-2 md:w-2/3">
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = brandColor;
                        e.currentTarget.style.boxShadow = `0 0 0 2px ${brandColor}40`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "#D1D5DB";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      className="
    w-full rounded-lg border border-gray-300
    px-4 py-2.5 text-sm
    focus:outline-none
    transition
    dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-300
  "
                    />

                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                      {showNew ? <EyeClosed className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Strength Meter */}
                  <div className="mt-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300  ${passwordScore >= level
                            ? passwordScore <= 2
                              ? "bg-red-500"
                              : passwordScore === 3
                                ? "bg-yellow-500"
                                : "bg-green-500"
                            : "bg-gray-200"
                            }`}
                        />
                      ))}
                    </div>

                    <p className="text-xs mt-2 text-gray-500 dark:text-gray-400">
                      {passwordScore <= 1 && "Weak password"}
                      {passwordScore === 2 && "Fair password"}
                      {passwordScore === 3 && "Good password"}
                      {passwordScore === 4 && "Strong password"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="grid md:grid-cols-3 items-center px-6 py-6 gap-4 dark:border-gray-700">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm new password <span style={{ color: brandColor }}>*</span>
                </label>

                <div className="md:col-span-2 md:w-2/3">
                  {/* Wrap ONLY input + eye in relative */}
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      onFocus={(e) => {
                        if (!(confirmPass && confirmPass !== newPass)) {
                          e.currentTarget.style.borderColor = brandColor;
                          e.currentTarget.style.boxShadow = `0 0 0 2px ${brandColor}40`;
                        }
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor =
                          confirmPass && confirmPass !== newPass
                            ? "#EF4444"
                            : "#D1D5DB";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      className={`
        w-full rounded-lg px-4 py-2.5 pr-10 text-sm border
        transition dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-300
        ${confirmPass && confirmPass !== newPass
                          ? "border-red-500 dark:border-red-500"
                          : "border-gray-300 dark:border-gray-600"
                        }
        focus:outline-none
        ${passwordError ? "shake" : ""}
      `}
                    />

                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                      {showConfirm ? (
                        <EyeClosed className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Error message OUTSIDE the relative container */}
                  {confirmPass && confirmPass !== newPass && (
                    <p className="text-xs text-red-500 mt-2">
                      Passwords do not match.
                    </p>
                  )}
                </div>

              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 px-6 py-4  bg-gray-50 rounded-b-xl dark:bg-neutral-800 dark:border-gray-700">
                <button
                  onClick={() => {
                    setCurrentPass("");
                    setNewPass("");
                    setConfirmPass("");
                  }}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 
                 bg-white hover:bg-gray-50 transition dark:bg-neutral-800 dark:border-gray-700 dark:hover:bg-neutral-700/50 dark:text-gray-300"
                >
                  Clear
                </button>

                <button
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                  onClick={() => {
                    if (newPass !== confirmPass) {
                      setPasswordError(true);
                      setTimeout(() => setPasswordError(false), 400);
                      return;
                    }
                    savePassword();
                  }}
                  disabled={isUpdating}
                  style={{
                    backgroundColor: isHovered
                      ? `${brandColor}CC` // slightly darker
                      : brandColor,
                  }}
                  className="px-4 py-2 text-sm rounded-lg
    text-white
    transition duration-200
    disabled:opacity-60 disabled:cursor-not-allowed
    flex items-center gap-2"
                >
                  {isUpdating && (
                    <svg
                      className="w-4 h-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="white"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="white"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                  )}

                  {isUpdating ? "Updating..." : "Update password"}
                </button>

              </div>

            </div>


            {/* ================= SESSIONS ================= */}

            <div className="bg-white rounded-xl p-6 mt-4 shadow dark:bg-neutral-800">

              <h2 className="font-semibold text-lg mb-4 dark:text-gray-200">
                Where you're logged in
              </h2>

              {/* Current */}
              {current && (
                <SessionCard
                  title="This device"
                  session={current}
                  current
                  brandColor={brandColor}
                />
              )}

              {/* Others */}
              {others.length > 0 && (
                <div className="mt-4 space-y-3 pt-4 dark:border-gray-700">

                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Other sessions
                  </p>

                  {others.map((s) => (
                    <SessionCard
                      key={s.id}
                      session={s}
                      brandColor={brandColor}
                      onLogout={() =>
                        confirmLogout(s.id)
                      }
                    />
                  ))}

                </div>
              )}

            </div>


          </motion.div>
        )}

        {tab === "appearance" && (
          <motion.div
            key="appearance"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white dark:bg-neutral-800 rounded-xl mt-4 shadow">

              {/* Header */}
              <div className="p-6  dark:border-gray-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Appearance
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Change how your dashboard looks and feels.
                </p>
              </div>


              {/* ================= COMPANY SETTINGS ================= */}
              {role === "admin" && (
                <div className="grid md:grid-cols-3 items-start px-6 py-6 gap-4">

                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Company settings
                    </p>
                    <p className="text-xs text-gray-500">
                      Update your company logo and name.
                    </p>
                  </div>

                  <div className="md:col-span-2 space-y-6">

                    {/* Logo */}
                    <div className="flex items-center gap-6">

                      <div className="w-20 h-20 rounded-lg border flex items-center justify-center overflow-hidden dark:border-neutral-700">
                        {companyLogo ? (
                          <img src={companyLogo} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs text-gray-400">No logo</span>
                        )}
                      </div>

                      <button
                        onClick={() => companyFileRef.current?.click()}
                        className="px-4 py-2 text-sm rounded-lg border dark:border-neutral-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-700 transition"
                      >
                        Upload logo
                      </button>

                      <input
                        ref={companyFileRef}
                        hidden
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          e.target.files && loadCompanyFile(e.target.files[0])
                        }
                      />
                    </div>

                    {/* Company Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                        Company name
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full md:w-96 rounded-lg border border-gray-300 px-4 py-2.5 text-sm
                   focus:outline-none dark:bg-neutral-800 dark:border-neutral-700 dark:text-gray-300"
                      />
                    </div>

                    {/* Save Button */}
                    <div>
                      <button
                        onClick={saveCompanySettings}
                        disabled={savingCompany}
                        style={{ backgroundColor: brandColor }}
                        className="px-5 py-2 rounded-lg text-white transition
               flex items-center gap-2
               disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {savingCompany && (
                          <svg
                            className="w-4 h-4 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="white"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="white"
                              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                            />
                          </svg>
                        )}

                        {savingCompany ? "Saving..." : "Save company settings"}
                      </button>
                    </div>


                  </div>
                </div>
              )}


              {/* Brand Color */}
              <div className="grid md:grid-cols-3 items-center px-6 py-6 dark:border-neutral-800 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Brand color
                  </p>
                  <p className="text-xs text-gray-500">
                    Select or customize your brand color.
                  </p>
                </div>

                <div className="md:col-span-2 flex items-center flex-wrap gap-3">
                  {["#7F56D9", "#16A34A", "#2563EB", "#DB2777", "#EA580C"].map((color) => (
                    <button
                      key={color}
                      onClick={() => setBrandColor(color)}
                      className="w-7 h-7 rounded-full transition"
                      style={{
                        backgroundColor: color,
                        boxShadow:
                          brandColor === color
                            ? `0 0 0 3px ${color}`
                            : "none",
                      }}
                    />
                  ))}


                  <input
                    type="color"
                    value={brandColor}
                    onChange={(e) => setBrandColor(e.target.value)}
                    className="w-8 h-8 border-none bg-transparent cursor-pointer"
                  />
                </div>
              </div>

              {/* Display Preference */}
              <div className="grid md:grid-cols-3 px-6 py-6 dark:border-gray-800 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Display preference
                  </p>
                  <p className="text-xs text-gray-500">
                    Switch between light and dark modes.
                  </p>
                </div>

                <div className="md:col-span-2 overflow-x-auto">
                  <div className="flex gap-4 min-w-max snap-x snap-mandatory pb-2">

                    {[
                      { label: "System preference", value: "system" },
                      { label: "Light mode", value: "light" },
                      { label: "Dark mode", value: "dark" },
                    ].map((modeOption) => (
                      <div
                        key={modeOption.value}
                        onClick={() => setTheme(modeOption.value as any)}
                        className="w-40 m-2 rounded-xl border border-gray-300 dark:border-gray-700 p-3 cursor-pointer transition"
                        style={
                          theme === modeOption.value
                            ? {
                              boxShadow: `0 0 0 2px ${brandColor}`,
                            }
                            : {}
                        }
                      >
                        <div className="h-20 bg-gray-100 dark:bg-gray-800 rounded-md mb-3">
                          {modeOption.value === "system" && (
                            <div className="flex items-center justify-center bg-gray-900 border rounded-md h-full text-gray-400">
                              <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                                />
                              </svg>
                            </div>
                          )}
                          {modeOption.value === "light" && (
                            <div className="flex items-center justify-center border rounded-md border-gray-300 h-full text-yellow-500">
                              <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                                />
                              </svg>
                            </div>
                          )}
                          {modeOption.value === "dark" && (
                            <div className="flex items-center justify-center h-full bg-gray-900 border rounded-md text-gray-300">
                              <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M20.354 15.354A9 9 0 118.646 3.646 9.003 9.003 0 0020.354 15.354z"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-center text-gray-700 dark:text-gray-300">
                          {modeOption.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>







            </div>
          </motion.div>
        )}

        {tab === "notifications" && (
          <motion.div
            key="notifications"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white dark:bg-neutral-900 rounded-xl mt-4 shadow">

              {/* Header */}
              <div className="p-6 border-b dark:border-neutral-800">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Notification settings
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  We may still send important notifications about your account outside of your notification settings.
                </p>
              </div>

              {/* Sections */}
              {[
                {
                  key: "comments",
                  title: "Comments",
                  desc: "Notifications for comments on your posts and replies.",
                },
                {
                  key: "tags",
                  title: "Tags",
                  desc: "Notifications when someone tags you.",
                },
                {
                  key: "reminders",
                  title: "Reminders",
                  desc: "Notifications to remind you of updates you might have missed.",
                },
                {
                  key: "activity",
                  title: "More activity about you",
                  desc: "Notifications for likes and other interactions.",
                },
              ].map((item, index, arr) => (
                <div
                  key={item.key}
                  className={`grid md:grid-cols-3 px-6 py-6 gap-6 ${index !== arr.length - 1
                    ? "border-b dark:border-neutral-800"
                    : ""
                    }`}
                >
                  {/* LEFT TEXT */}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {item.desc}
                    </p>
                  </div>

                  {/* RIGHT TOGGLES */}
                  <div className="md:col-span-2 space-y-4">

                    {(["push", "email", "sms"] as const).map((type) => (
                      <div
                        key={type}
                        className="flex items-center justify-between max-w-xs"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {type}
                        </span>

                        <ToggleSwitch
                          enabled={
                            notifications[item.key as keyof typeof notifications][type]
                          }
                          onChange={() =>
                            toggleNotification(
                              item.key as keyof typeof notifications,
                              type
                            )
                          }
                        />
                      </div>
                    ))}

                  </div>
                </div>
              ))}

            </div>
          </motion.div>
        )}




























      </AnimatePresence>


      {/* ================= CONFIRM ================= */}

      <AnimatePresence>
        {confirmId && (
          <motion.div
            className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >

            <motion.div
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 dark:bg-neutral-700"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >

              <h3 className="text-lg font-semibold mb-2 dark:text-gray-200">
                Confirm Logout
              </h3>

              <p className="text-sm text-gray-500 mb-6 dark:text-gray-300">
                Are you sure you want to logout?
              </p>

              <div className="flex justify-end gap-3">

                <button
                  onClick={() => setConfirmId(null)}
                  className="px-4 py-2 rounded-lg border hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>

                <button
                  onClick={logoutSession}
                  disabled={isLoggingOut}
                  style={{ backgroundColor: brandColor }}
                  className="px-4 py-2 flex items-center gap-2 rounded-lg  text-white transition
          disabled:opacity-50"
                >
                  {isLoggingOut && (
                    <svg
                      className="w-4 h-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="white"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="white"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                  )}
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </button>

              </div>

            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= CROP ================= */}
      <AnimatePresence>
        {image && (
          <motion.div
            className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >

            <motion.div
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 dark:bg-neutral-700"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >

              <div className="relative h-64 bg-neutral-900 mb-4">

                <Cropper
                  image={image}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />

              </div>

              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) =>
                  setZoom(Number(e.target.value))
                }
                className="w-full mb-3 dark:bg-neutral-800 dark:border-gray-700"
              />

              <div className="flex justify-end gap-2">

                <button
                  onClick={() =>
                    setImage(null)
                  }
                  className="px-4 py-2 border rounded-lg dark:border-gray-600 dark:text-gray-300 hover:bg-neutral-50 transition dark:hover:bg-neutral-900/50"
                >
                  Cancel
                </button>

                <button
                  onClick={saveCrop}
                  style={{ backgroundColor: brandColor }}
                  className="px-4 py-2 text-white rounded-lg hover:bg-gray-700 transition dark:bg-gray-800 dark:hover:bg-gray-700/80 flex items-center gap-2"
                >
                  Apply
                </button>

              </div>

            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {companyImage && (
          <motion.div
            className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 dark:bg-neutral-700"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="relative h-64 bg-neutral-900 mb-4">
                <Cropper
                  image={companyImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full mb-3"
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setCompanyImage(null)}
                  className="px-4 py-2 border rounded-lg dark:border-gray-600 dark:text-gray-300 hover:bg-neutral-50 transition dark:hover:bg-neutral-900/50"
                >
                  Cancel
                </button>

                <button
                  onClick={saveCompanyCrop}
                  style={{ backgroundColor: brandColor }}
                  className="px-4 py-2 text-white rounded-lg"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}

/* ================= SESSION CARD ================= */

function SessionCard({
  session,
  current,
  onLogout,
  title,
  brandColor,
}: {
  session: SessionItem;
  current?: boolean;
  title?: string;
  onLogout?: () => void;
  brandColor: string;
}) {
  return (
    <div className="border rounded-lg px-4 py-3 flex items-center justify-between dark:border-neutral-700 dark:bg-neutral-700">

      <div>

        {title && (
          <p className="text-xs mb-1" style={{ color: brandColor }}>
            {title}
          </p>
        )}

        <p className="text-sm font-medium dark:text-gray-200">

          {session.device.browser} •{" "}
          {session.device.os} •{" "}
          {session.device.device}

        </p>

        <p className="text-xs text-gray-500">

          {session.createdAt
            ?.toDate?.()
            .toLocaleString()}

        </p>

      </div>

      {!current && (
        <button
          onClick={onLogout}
          className="text-sm text-red-600"
        >
          Logout
        </button>
      )}

      {current && (
        <div className="border border-gray-400 rounded-md flex items-center px-1.5 py-0.5">
          <div className="w-2 h-2 bg-green-400 rounded-full mr-2 ml-1" />
          <span className="text-xs text-green-700">Active now</span>
        </div>
      )}

    </div>
  );
}

function ToggleSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={`relative w-10 h-5 rounded-full transition ${enabled
        ? "bg-[var(--brand-color)]"
        : "bg-gray-300 dark:bg-neutral-700"
        }`}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
        style={{
          left: enabled ? "22px" : "2px",
        }}
      />
    </button>
  );
}



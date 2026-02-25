import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sendEmailVerification } from "firebase/auth";
import { auth, db } from "../firebase";
import useTheme from "../hooks/useTheme";
import { doc, getDoc } from "firebase/firestore";
import { setAppTitle } from "../utils/appTitle";

export default function Auth() {
    const [mode, setMode] = useState<"login" | "register">("login");
    const companyId = "main-company";
    const [companyName, setCompanyName] = useState("");
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const [companyImage] = useState<string | null>(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");

    const [remember, setRemember] = useState(false);
    const [toast, setToast] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const { login, register } = useAuth();
    const navigate = useNavigate();
    type Role = "broker" | "client";

    const [role, setRole] = useState<Role>("client");
    const { theme, toggleTheme } = useTheme();


    useEffect(() => {
        const loadCompany = async () => {
            const cached = localStorage.getItem("company-branding");

            if (cached) {
                const data = JSON.parse(cached);
                setCompanyName(data.name);
                setCompanyLogo(data.logoURL);
            }

            const snap = await getDoc(doc(db, "companies", companyId));

            if (snap.exists()) {
                const data = snap.data();

                setCompanyName(data.name || "");
                setCompanyLogo(data.logoURL || null);
                setAppTitle(data.name || "");
                localStorage.setItem(
                    "company-branding",
                    JSON.stringify({
                        name: data.name,
                        logoURL: data.logoURL,
                    })
                );

            }

        };

        loadCompany();
    }, []);


    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => {
                setToast(null);
            }, 5000);

            return () => clearTimeout(timer);
        }
    }, [toast]);

    const resendVerification = async () => {
        const user = auth.currentUser;

        if (!user) {
            setToast({
                type: "error",
                message: "Please login first.",
            });
            return;
        }

        try {
            await sendEmailVerification(user);

            setToast({
                type: "success",
                message: "Verification email sent again.",
            });
        } catch {
            setToast({
                type: "error",
                message: "Failed to resend email.",
            });
        }
    };

    // ---------------- LOGIN ----------------
    const handleLogin = async () => {
        try {
            setLoading(true);


            await login(email, password, remember);


            navigate("/dashboard");
        } catch (err: any) {

            if (err.message === "Email not verified") {
                setToast({
                    type: "error",
                    message: "Please verify your email first.",
                });
            } else {
                setToast({
                    type: "error",
                    message: "Error Invalid credentials.",
                });
            }

        }
        finally {
            setLoading(false);
        }
    };

    // ---------------- REGISTER ----------------
    const handleRegister = async () => {
        if (!firstName || !lastName || !email || !password || !confirm) {
            setToast({
                type: "error",
                message: "All fields are required",
            });
            return;
        }

        if (password !== confirm) {
            setToast({
                type: "error",
                message: "Passwords do not match",
            });
            return;
        }

        try {
            setLoading(true);


            const trimmedEmail = email.trim();

            await register(
                trimmedEmail,
                password,
                role,
                firstName,
                lastName
            );

            setToast({
                type: "success",
                message:
                    "Registration successful! Please check your email to verify your account.",
            });

            setMode("login");
            setFirstName("");
            setLastName("");
            setEmail("");
            setPassword("");
            setConfirm("");

        } catch (err: any) {
            console.error("REGISTER ERROR:", err);

            if (err.code === "auth/email-already-in-use") {
                setToast({
                    type: "error",
                    message: "This email is already registered. Please log in.",
                });
            } else if (err.code === "auth/weak-password") {
                setToast({
                    type: "error",
                    message: "Password should be at least 6 characters.",
                });
            } else if (err.code === "auth/invalid-email") {
                setToast({
                    type: "error",
                    message: "Please enter a valid email address.",
                });
            } else {
                setToast({
                    type: "error",
                    message: "Registration failed. Try again.",
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="
      min-h-screen relative flex items-center justify-center
      overflow-hidden
      bg-white dark:bg-black
      px-4
    "
        >

            {/* Light / Dark Glow */}
            <div
                className="
        absolute inset-0
        bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.25)_0%,rgba(255,255,255,0.9)_60%)]
        dark:bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.25)_0%,rgba(0,0,0,0.9)_60%)]
        pointer-events-none
      "
            />

            {/* Grid */}
            <div
                className="
        absolute inset-0
        bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),
            linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)]
        dark:bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),
            linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)]
        bg-[size:40px_40px]
        opacity-30
        pointer-events-none
      "
            />

            {/* Card */}
            <div
                className="
    relative z-10
    w-full max-w-md

    max-h-[90dvh]
    overflow-y-auto
    rounded-2xl
    p-6 sm:p-8

    bg-white
    dark:bg-white/5

    border border-gray-200
    dark:border-white/20

    shadow-xl
    dark:shadow-2xl

    backdrop-blur-xl
  "
            >
                {/* Theme Toggle (Inside Card) */}
                <button
                    onClick={toggleTheme}
                    className="
    absolute
    top-3 right-3
    sm:top-4 sm:right-4

    w-9 h-9 sm:w-10 sm:h-10

    rounded-lg
    backdrop-blur-md

    bg-black/20 dark:bg-white/5
    border border-white/20

    flex items-center justify-center
    text-sm sm:text-lg

    hover:scale-105 transition
  "
                >
                    {theme === "dark" ? "☀️" : "🌙"}
                </button>


                {/* Logo */}
                <div className="flex flex-col items-center mb-2 gap-2">
                    <img
                        src={
                            companyImage
                                ? companyImage
                                : companyLogo
                                    ? companyLogo
                                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}`
                        }
                        alt="Company Logo"
                        className="h-16 w-16 rounded-xl object-cover"
                    />

                    <h2
                        className="text-[22px] font-bold text-center truncate max-w-[200px]"
                        style={{ color: "var(--brand-color)" }}
                    >
                        {companyName || "Company"}
                    </h2>
                </div>



                {/* Title */}
                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white">
                    Log in to your account
                </h2>

                <p className="text-center text-gray-500 text-sm mb-6">
                    Welcome back! Please enter your details.
                </p>

                {/* Tabs */}
                <div className="flex bg-black/10 dark:bg-white/10 rounded-lg p-1 mb-6">

                    <button
                        onClick={() => {
                            setMode("register");
                            setToast(null);
                        }}
                        className={`w-1/2 py-2 rounded-md text-sm transition dark:text-white text-indigo-600
            ${mode === "register"
                                ? "bg-indigo-600 text-white dark:bg-indigo-600 shadow font-medium"
                                : "text-gray-400"
                            }`}
                    >
                        Sign up
                    </button>

                    <button
                        onClick={() => {
                            setMode("login");
                            setToast(null);
                        }}
                        className={`w-1/2 py-2 rounded-md text-sm transition dark:text-white text-indigo-600
            ${mode === "login"
                                ? "bg-indigo-600 text-white dark:bg-indigo-600 shadow font-medium"
                                : "text-gray-400"
                            }`}
                    >
                        Log in
                    </button>

                </div>

                {/* Toast */}
                {toast && (
                    <div
                        className={`
      fixed top-6 left-1/2 -translate-x-1/2 z-50
      px-6 py-3 rounded-lg shadow-lg text-sm font-medium
     text-center
      transition-all duration-300 ease-in-out

      ${toast.type === "success"
                                ? "bg-green-500 text-white"
                                : "bg-red-500 text-white"
                            }

      animate-toast
    `}
                    >
                        {toast.message}

                        {/* Resend button (only for verify error) */}
                        {toast.message.includes("verify") && (
                            <button
                                onClick={resendVerification}
                                className="ml-4 underline font-semibold"
                            >
                                Resend
                            </button>
                        )}
                    </div>
                )}



                {/* Email */}
                <div className="mb-4">
                    <label className="text-sm text-gray-600 dark:text-gray-300">
                        Email
                    </label>

                    <input
                        type="email"
                        placeholder="Enter your email"
                        required
                        className="
            w-full mt-1 px-4 py-3 rounded-lg
            bg-white/80 dark:bg-black/40
            border border-white/20
            text-gray-900 dark:text-white
            focus:ring-2 focus:ring-indigo-500
            outline-none
          "
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                {/* Password */}
                <div className="mb-4">
                    <label className="text-sm text-gray-600 dark:text-gray-300">
                        Password
                    </label>

                    <div className="relative">

                        <input
                            type={showPass ? "text" : "password"}
                            placeholder="••••••••"
                            required
                            className="
              w-full mt-1 px-4 py-3 rounded-lg
              bg-white/80 dark:bg-black/40
              border border-white/20
              text-gray-900 dark:text-white
              focus:ring-2 focus:ring-indigo-500
              outline-none
            "
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        <button
                            type="button"
                            onClick={() => setShowPass(!showPass)}
                            className="absolute right-3 top-5 text-xs text-gray-400"
                        >
                            {showPass ? "Hide" : "Show"}
                        </button>

                    </div>
                </div>

                {/* Confirm */}
                {mode === "register" && (
                    <>
                        {/* Confirm */}
                        <input
                            type="password"
                            placeholder="Confirm password"
                            className="
        w-full mb-4 px-4 py-3 rounded-lg
        bg-white/80 dark:bg-black/40
        border border-white/20 text-gray-900 dark:text-white
        focus:ring-2 focus:ring-indigo-500
        outline-none
      "
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                        />

                        {/* First Name */}
                        <div className="mb-4">
                            <label className="text-sm text-gray-600 dark:text-gray-300">
                                First Name
                            </label>
                            <input
                                type="text"
                                placeholder="Enter first name"
                                className="w-full mt-1 px-4 py-3 rounded-lg
        bg-white/80 dark:bg-black/40
        border border-white/20 text-gray-900 dark:text-white
        focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                            />
                        </div>

                        {/* Last Name */}
                        <div className="mb-4">
                            <label className="text-sm text-gray-600 dark:text-gray-300">
                                Last Name
                            </label>
                            <input
                                type="text"
                                placeholder="Enter last name"
                                className="w-full mt-1 px-4 py-3 rounded-lg
        bg-white/80 dark:bg-black/40
        border border-white/20 text-gray-900 dark:text-white
        focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                            />
                        </div>

                        {/* Role */}
                        <div className="mb-4">
                            <label className="text-sm text-gray-600 dark:text-gray-300">
                                Account Type
                            </label>

                            <select
                                value={role}
                                onChange={(e) =>
                                    setRole(e.target.value as Role)
                                }
                                className="
        w-full mb-4 px-4 py-3 rounded-lg
        bg-white/80 dark:bg-black/40
        border border-white/20 text-gray-900 dark:text-white
        focus:ring-2 focus:ring-indigo-500
        outline-none
      "
                            >
                                <option value="client">
                                    Client
                                </option>

                                <option value="broker">
                                    Broker
                                </option>
                            </select>
                        </div>
                    </>
                )}


                {/* Remember */}
                {mode === "login" && (
                    <div className="flex justify-between items-center mb-6 text-sm">

                        <label className="flex items-center gap-2 text-gray-500">
                            <input
                                type="checkbox"
                                checked={remember}
                                onChange={() => setRemember(!remember)}
                            />
                            Remember for 30 days
                        </label>

                        <span className="text-indigo-500 cursor-pointer">
                            Forgot password
                        </span>

                    </div>
                )}

                {/* Main Button */}
                <button
                    disabled={loading}
                    onClick={mode === "login" ? handleLogin : handleRegister}
                    className="
          w-full py-3 rounded-lg
          bg-indigo-600 text-white font-medium
          hover:bg-indigo-700 transition flex items-center justify-center gap-2
          disabled:opacity-50
        "
                >
                    {loading && (
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
                    {loading
                        ? "Please wait..."
                        : mode === "login"
                            ? "Sign in"
                            : "Create account"}
                </button>

                {/* Google */}
                {/* {mode === "login" && (
                    <button
                        className="
            w-full mt-4 py-3 rounded-lg
            border border-white/20
            flex items-center justify-center gap-2
            hover:bg-white/10
          "
                    >
                        <img
                            src="https://www.svgrepo.com/show/475656/google-color.svg"
                            className="w-5 h-5"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-300">
                            Sign in with Google
                        </span>
                    </button>
                )} */}

            </div>
        </div>
    );

}

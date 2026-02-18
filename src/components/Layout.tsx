import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  useNavigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  LayoutDashboard,
  BarChart3,
  FileText,
  Bell,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Mail
} from "lucide-react";
import {
  doc,
  getDoc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import useTheme from "../hooks/useTheme";
import { setAppTitle } from "../utils/appTitle";
import { getDatabase, ref, set, onDisconnect } from "firebase/database";



export default function Layout() {
  const { user, role, logout } = useAuth();
  useTheme(); // ensures CSS variable is applied

  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const auth = getAuth();
  const firebaseUser = auth.currentUser;

  const rtdb = getDatabase();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const companyId = "main-company";
  const [companyName, setCompanyName] = useState("");
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [companyImage] = useState<string | null>(null);
  const routeMap: Record<string, string> = {
    "/dashboard": "Overview",
    "/dashboard/analytics": "Analytics",
    "/dashboard/reports": "Reports",
    "/dashboard/notifications": "Notifications",
    "/dashboard/users": "Users",
    "/dashboard/settings": "Settings",
    "/dashboard/profile": "Profile",
    "/dashboard/messages": "Messages",
  };



  const currentPage =
    routeMap[location.pathname] || "Overview";

  const goTo = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      setShowLogout(false);
      navigate("/");
    } catch {
      setIsLoggingOut(false);
    }
  };

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
    if (!firebaseUser) return;

    const userStatusRef = ref(rtdb, `status/${firebaseUser.uid}`);

    set(userStatusRef, {
      online: true,
      lastChanged: Date.now(),
    });

    onDisconnect(userStatusRef).set({
      online: false,
      lastChanged: Date.now(),
    });

  }, [firebaseUser]);



  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black relative overflow-x-hidden transition-colors duration-300">

      {/* MOBILE OVERLAY */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
        />
      )}

      {/* LOGOUT MODAL */}
      <AnimatePresence>
        {showLogout && (
          <motion.div
            className="fixed inset-0 z-[999] bg-black/40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white dark:bg-neutral-700 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 border border-gray-200 dark:border-neutral-800"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Confirm Logout
              </h3>

              <p className="text-sm text-gray-500 mb-6 dark:text-gray-300">
                Are you sure you want to logout?
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowLogout(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 dark:text-gray-300 transition"
                >
                  Cancel
                </button>

                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  style={{ backgroundColor: "var(--brand-color)" }}
                  className="px-4 py-2 rounded-lg text-white transition disabled:opacity-60"
                >
                  {isLoggingOut ? "Logging out..." : "Logout"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SIDEBAR */}
      <aside
        className={`
          fixed top-0 left-0 h-screen
          bg-white dark:bg-neutral-900
          border-r border-gray-200 dark:border-neutral-800
          flex flex-col z-50 transition-all duration-300 ease-in-out
          ${open ? "w-64" : "w-20"}
          ${mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
          }
        `}
      >
        {/* Header */}
        <div className="px-3 h-16 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between">

          {(open || mobileOpen) && (
            <div className="flex items-center gap-1">
              <img
                src={
                  companyImage   // preview while editing
                    ? companyImage
                    : companyLogo
                      ? companyLogo
                      : `https://ui-avatars.com/api/?name=${encodeURIComponent(companyName)}`
                }
                alt="Company Logo"
                className="h-10 w-10  object-cover dark:border-neutral-700"
              />

              <h2
                className="text-lg font-bold truncate"
                style={{ color: "var(--brand-color)" }}
              >
                {companyName}
              </h2>
            </div>
          )}


          <button
            onClick={() => setOpen(!open)}
            className="hidden lg:flex px-4 py-2 rounded-lg
             text-gray-600 dark:text-gray-300
             hover:bg-gray-100 dark:hover:bg-neutral-800
             transition"
          >
            <Menu size={22} className="text-inherit" />
          </button>

          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-2 rounded-lg
             text-gray-600 dark:text-gray-300
             hover:bg-gray-100 dark:hover:bg-neutral-800
             transition"
          >
            <X size={22} className="text-inherit" />
          </button>


        </div>

        {/* Menu */}
        <nav className="flex-1 px-2 py-6 space-y-1">

          <MenuItem
            icon={<LayoutDashboard size={20} />}
            label="Overview"
            open={open || mobileOpen}
            active={location.pathname === "/dashboard"}
            onClick={() => goTo("/dashboard")}
          />

          {role === "admin" && (
            <>
              <MenuItem
                icon={<Users size={20} />}
                label="Users"
                open={open || mobileOpen}
                active={location.pathname === "/dashboard/users"}
                onClick={() => goTo("/dashboard/users")}
              />

              <MenuItem
                icon={<BarChart3 size={20} />}
                label="Analytics"
                open={open || mobileOpen}
                active={location.pathname === "/dashboard/analytics"}
                onClick={() => goTo("/dashboard/analytics")}
              />
              <MenuItem
                icon={<Mail size={20} />}
                label="Messages"
                open={open || mobileOpen}
                active={location.pathname === "/dashboard/messages"}
                onClick={() => goTo("/dashboard/messages")}
              />
            </>
          )}

          {/* BROKER */}
          {role === "broker" && (
            <>
              <MenuItem
                icon={<FileText size={20} />}
                label="My Listings"
                open={open || mobileOpen}
                active={
                  location.pathname === "/dashboard/listings"
                }
                onClick={() =>
                  goTo("/dashboard/listings")
                }
              />
              <MenuItem
                icon={<Mail size={20} />}
                label="Messages"
                open={open || mobileOpen}
                active={location.pathname === "/dashboard/messages"}
                onClick={() => goTo("/dashboard/messages")}
              />
            </>
          )}

          {/* CLIENT */}
          {role === "client" && (
            <>
              <MenuItem
                icon={<Bell size={20} />}
                label="My Bookings"
                open={open || mobileOpen}
                active={
                  location.pathname === "/dashboard/bookings"
                }
                onClick={() =>
                  goTo("/dashboard/bookings")
                }
              />
              <MenuItem
                icon={<Mail size={20} />}
                label="Messages"
                open={open || mobileOpen}
                active={location.pathname === "/dashboard/messages"}
                onClick={() => goTo("/dashboard/messages")}
              />
            </>
          )}


          <MenuItem
            icon={<Settings size={20} />}
            label="Settings"
            open={open || mobileOpen}
            active={location.pathname === "/dashboard/settings"}
            onClick={() => goTo("/dashboard/settings")}
          />

        </nav>

        {/* Profile + Logout */}
        <div className="border-t border-gray-200 dark:border-neutral-800 px-3 py-4 space-y-2">

          {user && (
            <button
              onClick={() => goTo("/dashboard/settings")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
            >
              <img
                src={
                  user.photoURL ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.displayName ||
                    user.email ||
                    "User"
                  )}`
                }
                className="w-9 h-9 rounded-full border border-gray-300 dark:border-neutral-700 object-cover"
              />

              {(open || mobileOpen) && (
                <div className="text-left truncate">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {user.displayName || "No Name"}
                  </p>
                  <p className="text-xs text-gray-400 truncate max-w-[140px]">
                    {user.email}
                  </p>
                </div>
              )}
            </button>
          )}

          <button
            onClick={() => setShowLogout(true)}
            className="w-full flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition hover:bg-gray-100 dark:hover:bg-neutral-800"
            style={{ color: "red" }}
          >
            <LogOut size={18} />
            {(open || mobileOpen) && <span>Logout</span>}
          </button>

        </div>
      </aside>

      {/* MAIN */}
      <div
        className={`
          min-h-screen flex flex-col transition-all duration-300
          ${open ? "lg:ml-64" : "lg:ml-20"}
        `}
      >
        <header className="h-16 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">

          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800 transition"
            >
              <Menu size={22} />
            </button>

            <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              Dashboard / {currentPage}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-tight">
                <span className="block sm:inline">Welcome,</span>
                <span
                  className="block sm:inline sm:ml-1"
                  style={{ color: "var(--brand-color)" }}
                >
                  {user.displayName || "No Name"}
                </span>
                <span className="hidden sm:ml-1">👋</span>
              </p>
            )}

            <button
              onClick={toggleTheme}
              className="
        w-9 h-9 sm:w-10 sm:h-10
        rounded-lg
        bg-gray-100 dark:bg-neutral-800
        border border-gray-200 dark:border-neutral-700
        flex items-center justify-center
        text-lg
        hover:scale-105 transition
      "
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>

        </header>


        <main className="flex-1 p-3 lg:p-6 overflow-hidden dark:bg-neutral-900">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

      </div>
    </div>
  );
}

/* ================= MENU ITEM ================= */

function MenuItem({
  icon,
  label,
  open,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center
        ${open ? "gap-3 px-4" : "justify-center"}
        py-2.5 rounded-lg text-gray-600 dark:text-gray-300
        text-sm font-medium transition-all duration-200
        hover:translate-x-1
      `}
      style={{
        color: active ? "var(--brand-color)" : undefined,
        backgroundColor: active ? "rgba(0,0,0,0.03)" : undefined,
      }}
    >
      {icon}
      {open && <span>{label}</span>}
    </button>
  );
}

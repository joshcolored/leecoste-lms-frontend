import {
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import {
  lazy,
  Suspense,
} from "react";

import GlobalLoader from "./components/GlobalLoader";
import { useAuth } from "./context/AuthContext";

import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";
import AdminRoute from "./components/AdminRoutes"; // ✅ FIXED NAME

/* Lazy Pages */
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(
  () => import("./pages/Dashboard")
);
const Users = lazy(
  () => import("./pages/Users")
);
const Messages = lazy(
  () => import("./pages/Messages")
);

const Settings = lazy(() => import("./pages/Settings"));

export default function App() {
  const { loading } = useAuth();

  return (
    <>
      {/* Global Loader (Auth) */}
      {loading && <GlobalLoader />}

      {/* Lazy Loader */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        }
      >
        <Routes>

          {/* ================= PUBLIC ================= */}
          <Route
            path="/"
            element={<Auth />}
          />

          {/* ================= PROTECTED ================= */}
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >

            {/* Dashboard */}
            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            {/* Admin → Users */}
            <Route
              path="/dashboard/users"
              element={
                <AdminRoute>
                  <Users />
                </AdminRoute>
              }
            />

              {/* Admin → Messages */}
              <Route
              path="/dashboard/messages"
              element={
                  <Messages />
              }
            />

            <Route
              path="/dashboard/settings"
              element={<Settings />}
            />


          </Route>

          {/* ================= FALLBACK ================= */}
          <Route
            path="*"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

        </Routes>
      </Suspense>
    </>
  );
}

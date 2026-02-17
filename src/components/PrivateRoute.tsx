import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { JSX } from "react";

export default function PrivateRoute({
  children,
}: {
  children: JSX.Element;
}) {
  const { user, loading } = useAuth();

  /* Wait for Firebase */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center">

          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />

          <p className="text-gray-500 text-sm animate-pulse">
            Loading session...
          </p>

        </div>
      </div>
    );
  }

  /* Not logged in → redirect */
  if (!user) {
    return <Navigate to="/" replace />;
  }

  /* Logged in */
  return children;
}

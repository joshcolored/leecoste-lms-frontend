import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { JSX } from "react/jsx-dev-runtime";

export default function AdminRoutes({
  children,
}: {
  children: JSX.Element;
}) {
  const { role, loading } = useAuth();

  if (loading) return null;

  if (role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

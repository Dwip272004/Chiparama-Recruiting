import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function RequireAuth({ children, role }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && profile?.role !== role) {
    // Wrong role — redirect to their correct portal
    const dest = profile?.role === "admin" ? "/admin" : "/vendor";
    return <Navigate to={dest} replace />;
  }

  return children;
}

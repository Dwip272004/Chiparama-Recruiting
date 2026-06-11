import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { RequireAuth } from "./components/auth/RequireAuth";

import Login               from "./pages/Login";
import AdminLayout         from "./pages/admin/AdminLayout";
import AdminDashboard      from "./pages/admin/AdminDashboard";
import VendorsPage         from "./pages/admin/VendorsPage";
import JobAssignPage       from "./pages/admin/JobAssignPage";
import AdminSubmissionsPage from "./pages/admin/SubmissionsPage";
import ReportsPage          from "./pages/admin/ReportsPage";
import EmailDigestPage      from "./pages/admin/EmailDigestPage";
import VendorLayout        from "./pages/vendor/VendorLayout";
import VendorDashboard     from "./pages/vendor/VendorDashboard";
import AssignedJobsPage    from "./pages/vendor/AssignedJobsPage";
import CandidatesPage      from "./pages/vendor/CandidatesPage";
import VendorSubmissionsPage from "./pages/vendor/SubmissionsPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Admin portal */}
          <Route
            path="/admin"
            element={<RequireAuth role="admin"><AdminLayout /></RequireAuth>}
          >
            <Route index               element={<AdminDashboard />} />
            <Route path="vendors"      element={<VendorsPage />} />
            <Route path="jobs"         element={<JobAssignPage />} />
            <Route path="submissions"   element={<AdminSubmissionsPage />} />
            <Route path="reports"       element={<ReportsPage />} />
            <Route path="email-digest"  element={<EmailDigestPage />} />
          </Route>

          {/* Vendor portal */}
          <Route
            path="/vendor"
            element={<RequireAuth role="vendor"><VendorLayout /></RequireAuth>}
          >
            <Route index               element={<VendorDashboard />} />
            <Route path="jobs"         element={<AssignedJobsPage />} />
            <Route path="candidates"   element={<CandidatesPage />} />
            <Route path="submissions"  element={<VendorSubmissionsPage />} />
          </Route>

          {/* Root → login */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

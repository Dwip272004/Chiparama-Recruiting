import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Briefcase, Users, Send, LogOut, Building2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import NotificationBell from "../../components/NotificationBell";

const NAV = [
  { to: "/vendor",             label: "Dashboard",    icon: LayoutDashboard, end: true },
  { to: "/vendor/jobs",        label: "Assigned Jobs", icon: Briefcase },
  { to: "/vendor/candidates",  label: "Candidates",    icon: Users },
  { to: "/vendor/submissions", label: "Submissions",   icon: Send },
];

export default function VendorLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-60 flex-shrink-0 bg-indigo-950 flex flex-col">

        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">TalentBoard</p>
              <p className="text-indigo-400 text-[10px]">Vendor Portal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                 ${isActive
                   ? "bg-indigo-600 text-white"
                   : "text-indigo-300 hover:bg-white/5 hover:text-white"
                 }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {(profile?.full_name || profile?.email || "V")[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-medium truncate">
                {profile?.full_name || "Vendor"}
              </p>
              <p className="text-indigo-400 text-[10px] truncate">{profile?.email}</p>
            </div>
            <button onClick={handleSignOut}
              className="text-indigo-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
              title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-6 flex-shrink-0">
          <div />
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

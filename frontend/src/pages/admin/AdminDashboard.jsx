import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Users, Send, Trophy, ArrowRight, Clock } from "lucide-react";
import { supabase } from "../../lib/supabase";

const STAGE_COLORS = {
  submitted:            "bg-blue-100 text-blue-700",
  reviewing:            "bg-yellow-100 text-yellow-700",
  shortlisted:          "bg-purple-100 text-purple-700",
  interview_scheduled:  "bg-indigo-100 text-indigo-700",
  interview_completed:  "bg-cyan-100 text-cyan-700",
  placed:               "bg-green-100 text-green-700",
  rejected:             "bg-red-100 text-red-700",
  withdrawn:            "bg-gray-100 text-gray-500",
};

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
      <p className="text-sm font-medium text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats]       = useState({});
  const [recent, setRecent]     = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      const [jobsRes, vendorsRes, subsRes, placedRes, recentRes] = await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("vendors").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("submissions").select("id", { count: "exact", head: true }),
        supabase.from("submissions").select("id", { count: "exact", head: true }).eq("stage", "placed"),
        supabase.from("submissions")
          .select("id, stage, submitted_at, candidates(first_name, last_name), jobs(title), vendors(company_name)")
          .order("submitted_at", { ascending: false })
          .limit(8),
      ]);

      setStats({
        jobs:    jobsRes.count    ?? 0,
        vendors: vendorsRes.count ?? 0,
        subs:    subsRes.count    ?? 0,
        placed:  placedRes.count  ?? 0,
      });
      setRecent(recentRes.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Welcome back — here's your overview</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/admin/vendors"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white
                       rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            + Invite Vendor
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Briefcase} label="Active Jobs"       value={stats.jobs}    color="bg-indigo-100 text-indigo-600" />
        <StatCard icon={Users}     label="Active Vendors"    value={stats.vendors} color="bg-purple-100 text-purple-600" />
        <StatCard icon={Send}      label="Total Submissions" value={stats.subs}    color="bg-blue-100 text-blue-600" />
        <StatCard icon={Trophy}    label="Placements"        value={stats.placed}  color="bg-emerald-100 text-emerald-600" />
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-800">Recent Submissions</h2>
          <Link to="/admin/jobs" className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Send className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No submissions yet</p>
            <p className="text-sm mt-1">Assign jobs to vendors to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map(sub => (
              <div key={sub.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/50">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-indigo-600">
                    {sub.candidates?.first_name?.[0]}{sub.candidates?.last_name?.[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {sub.candidates?.first_name} {sub.candidates?.last_name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {sub.jobs?.title} · <span className="text-indigo-400">{sub.vendors?.company_name}</span>
                  </p>
                </div>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold capitalize
                                 ${STAGE_COLORS[sub.stage] ?? "bg-gray-100 text-gray-500"}`}>
                  {sub.stage?.replace(/_/g, " ")}
                </span>
                <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {new Date(sub.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, Send, Star, Clock, ArrowRight, AlertTriangle, MapPin } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

const STAGE_BADGE = {
  submitted:           "bg-blue-100 text-blue-700",
  reviewing:           "bg-yellow-100 text-yellow-700",
  shortlisted:         "bg-purple-100 text-purple-700",
  interview_scheduled: "bg-indigo-100 text-indigo-700",
  placed:              "bg-green-100 text-green-700",
  rejected:            "bg-red-100 text-red-600",
};

const WORK_BADGE = {
  onsite: "bg-emerald-100 text-emerald-700",
  remote: "bg-sky-100 text-sky-700",
  hybrid: "bg-violet-100 text-violet-700",
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function VendorDashboard() {
  const { profile } = useAuth();
  const [jobs, setJobs]         = useState([]);
  const [subs, setSubs]         = useState([]);
  const [vendor, setVendor]     = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (profile?.vendor_id) load();
  }, [profile]);

  async function load() {
    const vendorId = profile.vendor_id;
    const [vendorRes, assignRes, subsRes] = await Promise.all([
      supabase.from("vendors").select("*").eq("id", vendorId).single(),
      supabase.from("job_vendor_assignments")
        .select("*, jobs(*)")
        .eq("vendor_id", vendorId)
        .eq("status", "active")
        .order("assigned_at", { ascending: false }),
      supabase.from("submissions")
        .select("id, stage, submitted_at, jobs(title), candidates(first_name, last_name)")
        .eq("vendor_id", vendorId)
        .order("submitted_at", { ascending: false })
        .limit(6),
    ]);
    setVendor(vendorRes.data);
    setJobs(assignRes.data ?? []);
    setSubs(subsRes.data ?? []);
    setLoading(false);
  }

  const shortlisted = subs.filter(s => s.stage === "shortlisted").length;
  const placed      = subs.filter(s => s.stage === "placed").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {vendor?.primary_contact?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">{vendor?.company_name}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Briefcase} label="Assigned Jobs"   value={jobs.length}   color="bg-indigo-100 text-indigo-600" />
        <StatCard icon={Send}      label="Submitted"       value={subs.length}   color="bg-blue-100 text-blue-600" />
        <StatCard icon={Star}      label="Shortlisted"     value={shortlisted}   color="bg-purple-100 text-purple-600" />
        <StatCard icon={Clock}     label="Placed"          value={placed}        color="bg-emerald-100 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Assigned Jobs */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800">Your Jobs</h2>
            <Link to="/vendor/jobs" className="text-xs text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-1">
              See all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {jobs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No jobs assigned yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {jobs.slice(0, 4).map(a => (
                <Link key={a.id} to="/vendor/jobs"
                  className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600
                                  flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{a.jobs?.title?.[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{a.jobs?.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {a.jobs?.location_city && (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <MapPin className="w-3 h-3" />{a.jobs.location_city}
                        </span>
                      )}
                      {a.deadline && (
                        <span className={`text-xs font-medium ${
                          new Date(a.deadline) < new Date(Date.now() + 3*86400000)
                            ? "text-red-500" : "text-gray-400"
                        }`}>
                          Due {new Date(a.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize flex-shrink-0
                                   ${WORK_BADGE[a.jobs?.work_type] ?? "bg-gray-100 text-gray-500"}`}>
                    {a.jobs?.work_type}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Submissions */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-800">Recent Submissions</h2>
          </div>
          {subs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Send className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No submissions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {subs.map(s => (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-600 text-xs font-bold">
                      {s.candidates?.first_name?.[0]}{s.candidates?.last_name?.[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {s.candidates?.first_name} {s.candidates?.last_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{s.jobs?.title}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize flex-shrink-0
                                   ${STAGE_BADGE[s.stage] ?? "bg-gray-100 text-gray-500"}`}>
                    {s.stage?.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

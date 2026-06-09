import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { BarChart2, Trophy, Users, Send, TrendingUp, Star } from "lucide-react";

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-2xl font-bold text-gray-900">{value ?? "—"}</p>
      <p className="text-sm font-medium text-gray-600 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Bar({ pct, color = "bg-indigo-500" }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} />
    </div>
  );
}

export default function ReportsPage() {
  const [vendors, setVendors]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [sortBy, setSortBy]     = useState("total_submissions");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("vendor_performance").select("*");
    setVendors(data ?? []);
    setLoading(false);
  }

  const sorted = [...vendors].sort((a, b) => (b[sortBy] ?? 0) - (a[sortBy] ?? 0));

  const totals = vendors.reduce((acc, v) => ({
    submissions: acc.submissions + (v.total_submissions ?? 0),
    placed:      acc.placed      + (v.placements       ?? 0),
    shortlisted: acc.shortlisted + (v.shortlisted       ?? 0),
    vendors:     acc.vendors     + 1,
  }), { submissions: 0, placed: 0, shortlisted: 0, vendors: 0 });

  const maxSubs  = Math.max(...vendors.map(v => v.total_submissions ?? 0), 1);
  const maxPlace = Math.max(...vendors.map(v => v.placements ?? 0), 1);

  const SORT_OPTIONS = [
    { key: "total_submissions",   label: "Submissions" },
    { key: "placements",          label: "Placements" },
    { key: "shortlisted",         label: "Shortlisted" },
    { key: "placement_rate_pct",  label: "Placement Rate" },
    { key: "shortlist_rate_pct",  label: "Shortlist Rate" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-400 mt-0.5">Vendor performance overview</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Vendors"     value={totals.vendors}     color="indigo" />
        <StatCard label="Total Submissions"  value={totals.submissions} color="blue" />
        <StatCard label="Shortlisted"        value={totals.shortlisted} color="purple" />
        <StatCard label="Total Placements"   value={totals.placed}      color="green" />
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Sort by:</span>
        <div className="flex gap-2 flex-wrap">
          {SORT_OPTIONS.map(({ key, label }) => (
            <button key={key} onClick={() => setSortBy(key)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors
                          ${sortBy === key
                            ? "bg-indigo-600 text-white"
                            : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Vendor performance table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No data yet</p>
            <p className="text-sm mt-1">Vendor performance will appear once submissions are made</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Vendor</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Submissions</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Shortlisted</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Placed</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide w-40">Shortlist Rate</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide w-40">Placement Rate</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Jobs</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map((v, i) => (
                <tr key={v.vendor_id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {i < 3 && (
                        <Trophy className={`w-4 h-4 flex-shrink-0 ${
                          i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : "text-amber-600"
                        }`} />
                      )}
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{v.company_name?.[0]}</span>
                      </div>
                      <p className="font-semibold text-gray-800">{v.company_name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div>
                      <p className="font-bold text-gray-800">{v.total_submissions ?? 0}</p>
                      <Bar pct={((v.total_submissions ?? 0) / maxSubs) * 100} color="bg-blue-400" />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="font-semibold text-purple-700">{v.shortlisted ?? 0}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div>
                      <p className="font-bold text-emerald-700">{v.placements ?? 0}</p>
                      <Bar pct={((v.placements ?? 0) / maxPlace) * 100} color="bg-emerald-500" />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {v.shortlist_rate_pct ?? 0}%
                      </p>
                      <Bar pct={v.shortlist_rate_pct ?? 0} color="bg-purple-400" />
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        {v.placement_rate_pct ?? 0}%
                      </p>
                      <Bar pct={v.placement_rate_pct ?? 0} color="bg-emerald-400" />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center text-gray-600 font-medium">
                    {v.jobs_worked ?? 0}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold capitalize
                                     ${v.vendor_status === "active"
                                       ? "bg-emerald-100 text-emerald-700"
                                       : "bg-gray-100 text-gray-500"}`}>
                      {v.vendor_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

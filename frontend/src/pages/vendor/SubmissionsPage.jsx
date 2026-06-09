import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Send, Search, ChevronDown, ChevronUp, MessageSquare, Calendar } from "lucide-react";

const STAGE_BADGE = {
  submitted:            "bg-blue-100 text-blue-700",
  reviewing:            "bg-yellow-100 text-yellow-700",
  shortlisted:          "bg-purple-100 text-purple-700",
  interview_scheduled:  "bg-indigo-100 text-indigo-700",
  interview_completed:  "bg-indigo-50 text-indigo-600",
  client_submitted:     "bg-cyan-100 text-cyan-700",
  offer_extended:       "bg-teal-100 text-teal-700",
  offer_accepted:       "bg-emerald-100 text-emerald-700",
  placed:               "bg-green-100 text-green-700",
  rejected:             "bg-red-100 text-red-600",
  withdrawn:            "bg-gray-100 text-gray-500",
};

const STAGE_ORDER = [
  "submitted", "reviewing", "shortlisted", "interview_scheduled",
  "interview_completed", "client_submitted", "offer_extended",
  "offer_accepted", "placed",
];

function stagePct(stage) {
  const i = STAGE_ORDER.indexOf(stage);
  if (i < 0) return 0;
  return Math.round(((i + 1) / STAGE_ORDER.length) * 100);
}

function SubmissionRow({ sub }) {
  const [expanded, setExpanded]     = useState(false);
  const [interviews, setInterviews] = useState([]);

  async function loadInterviews() {
    if (interviews.length > 0) return;
    const { data } = await supabase.from("interviews")
      .select("*").eq("submission_id", sub.id).order("round_number");
    setInterviews(data ?? []);
  }
  const pct = stagePct(sub.stage);
  const isTerminal = sub.stage === "rejected" || sub.stage === "withdrawn";

  return (
    <>
      <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer"
        onClick={() => { setExpanded(v => !v); if (!expanded) loadInterviews(); }}>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600
                            flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {sub.candidates?.first_name?.[0]}{sub.candidates?.last_name?.[0]}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                {sub.candidates?.first_name} {sub.candidates?.last_name}
              </p>
              {sub.candidates?.current_title && (
                <p className="text-xs text-gray-400">{sub.candidates.current_title}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-5 py-3.5">
          <p className="text-sm font-medium text-gray-700 truncate max-w-[200px]">{sub.jobs?.title}</p>
        </td>
        <td className="px-5 py-3.5">
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold capitalize
                           ${STAGE_BADGE[sub.stage] ?? "bg-gray-100 text-gray-500"}`}>
            {sub.stage?.replace(/_/g, " ")}
          </span>
        </td>
        <td className="px-5 py-3.5">
          {isTerminal ? (
            <span className="text-xs text-gray-400 italic">—</span>
          ) : (
            <div className="w-28">
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">{pct}%</p>
            </div>
          )}
        </td>
        <td className="px-5 py-3.5 text-xs text-gray-400">
          {new Date(sub.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </td>
        <td className="px-5 py-3.5">
          {sub.admin_feedback_visible && sub.admin_feedback ? (
            <span className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
              <MessageSquare className="w-3 h-3" /> Feedback
            </span>
          ) : null}
        </td>
        <td className="px-5 py-3.5 text-right">
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-indigo-50/30">
          <td colSpan={7} className="px-5 py-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              {sub.cover_note && (
                <div className="col-span-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Cover Note</p>
                  <p className="text-gray-600 text-xs leading-relaxed">{sub.cover_note}</p>
                </div>
              )}
              <div>
                {sub.bill_rate && <p className="text-xs text-gray-500">Bill: <span className="font-semibold text-gray-700">${sub.bill_rate}/{sub.rate_type}</span></p>}
                {sub.pay_rate  && <p className="text-xs text-gray-500 mt-0.5">Pay: <span className="font-semibold text-gray-700">${sub.pay_rate}/{sub.rate_type}</span></p>}
                {sub.availability_date && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Available: <span className="font-semibold text-gray-700">
                      {new Date(sub.availability_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </p>
                )}
              </div>
              {sub.admin_feedback_visible && sub.admin_feedback && (
                <div className="col-span-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide mb-1">
                    Admin Feedback
                  </p>
                  <p className="text-indigo-700 text-xs leading-relaxed">{sub.admin_feedback}</p>
                </div>
              )}
              {sub.rejection_reason && (
                <div className="col-span-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-1">Rejection Reason</p>
                  <p className="text-red-700 text-xs">{sub.rejection_reason}</p>
                </div>
              )}

              {/* Interviews */}
              {interviews.length > 0 && (
                <div className="col-span-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">Interviews</p>
                  <div className="space-y-2">
                    {interviews.map(iv => (
                      <div key={iv.id} className="bg-teal-50 border border-teal-100 rounded-xl px-3 py-2.5 flex items-start gap-3">
                        <Calendar className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-gray-800 capitalize">
                            Round {iv.round_number} — {iv.interview_type} Interview
                          </p>
                          {iv.scheduled_at && (
                            <p className="text-[11px] text-gray-600 mt-0.5">
                              {new Date(iv.scheduled_at).toLocaleString("en-US", {
                                weekday: "short", month: "short", day: "numeric",
                                hour: "numeric", minute: "2-digit"
                              })}
                              {iv.duration_mins && ` · ${iv.duration_mins} min`}
                            </p>
                          )}
                          {iv.interviewer_name && <p className="text-[11px] text-gray-500">With: {iv.interviewer_name}</p>}
                          {iv.location_or_link && (
                            <a href={iv.location_or_link} target="_blank" rel="noreferrer"
                              className="text-[11px] text-teal-600 underline truncate block"
                              onClick={e => e.stopPropagation()}>
                              {iv.location_or_link}
                            </a>
                          )}
                          {iv.instructions && <p className="text-[11px] text-gray-500 mt-1 italic">{iv.instructions}</p>}
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize flex-shrink-0 ${
                          iv.outcome === "passed" ? "bg-green-100 text-green-700" :
                          iv.outcome === "failed" ? "bg-red-100 text-red-600" :
                          "bg-gray-100 text-gray-500"}`}>
                          {iv.outcome}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function SubmissionsPage() {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  useEffect(() => { if (profile?.vendor_id) load(); }, [profile]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("submissions")
      .select("*, jobs(title), candidates(first_name, last_name, current_title)")
      .eq("vendor_id", profile.vendor_id)
      .order("submitted_at", { ascending: false });
    setSubmissions(data ?? []);
    setLoading(false);
  }

  const filtered = submissions.filter(s => {
    const name = `${s.candidates?.first_name} ${s.candidates?.last_name}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase()) ||
      s.jobs?.title?.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === "all" || s.stage === stageFilter;
    return matchSearch && matchStage;
  });

  const counts = {};
  for (const s of submissions) counts[s.stage] = (counts[s.stage] ?? 0) + 1;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
        <p className="text-sm text-gray-400 mt-0.5">{submissions.length} total submissions</p>
      </div>

      {/* Stage summary pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all",         label: "All",         count: submissions.length },
          { key: "submitted",   label: "Submitted",   count: counts.submitted ?? 0 },
          { key: "reviewing",   label: "Reviewing",   count: counts.reviewing ?? 0 },
          { key: "shortlisted", label: "Shortlisted", count: counts.shortlisted ?? 0 },
          { key: "placed",      label: "Placed",      count: counts.placed ?? 0 },
          { key: "rejected",    label: "Rejected",    count: counts.rejected ?? 0 },
        ].map(({ key, label, count }) => (
          <button key={key} onClick={() => setStageFilter(key)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors
                        ${stageFilter === key
                          ? "bg-indigo-600 text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}>
            {label} {count > 0 && <span className="ml-1 opacity-70">({count})</span>}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by candidate or job…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Send className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{search || stageFilter !== "all" ? "No submissions match" : "No submissions yet"}</p>
            {!search && stageFilter === "all" && (
              <p className="text-sm mt-1">Go to Assigned Jobs and click "Submit" to get started</p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Candidate</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Job</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Stage</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Progress</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Submitted</th>
                <th className="px-5 py-3" />
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => <SubmissionRow key={s.id} sub={s} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

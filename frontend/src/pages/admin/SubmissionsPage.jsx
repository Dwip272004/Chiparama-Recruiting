import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { Search, X, Send, Loader, Calendar, Plus, Download, Zap } from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001";

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

const ALL_STAGES = [
  "submitted", "reviewing", "shortlisted", "interview_scheduled",
  "interview_completed", "client_submitted", "offer_extended",
  "offer_accepted", "placed", "rejected", "withdrawn",
];

function scoreColor(n) {
  if (n >= 80) return "bg-emerald-100 text-emerald-700";
  if (n >= 60) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-600";
}

function exportCSV(subs) {
  const cols = ["Candidate","Job","Vendor","Stage","Work Auth","Experience","Bill Rate","Pay Rate","Match Score","Submitted"];
  const rows = subs.map(s => [
    `${s.candidates?.first_name ?? ""} ${s.candidates?.last_name ?? ""}`.trim(),
    s.jobs?.title ?? "",
    s.vendors?.company_name ?? "",
    s.stage ?? "",
    s.candidates?.work_authorization ?? "",
    s.candidates?.experience_years != null ? `${s.candidates.experience_years} yrs` : "",
    s.bill_rate ? `$${s.bill_rate}/${s.rate_type}` : "",
    s.pay_rate  ? `$${s.pay_rate}/${s.rate_type}` : "",
    s.match_score != null ? `${s.match_score}` : "",
    s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : "",
  ]);
  const csv = [cols, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `submissions_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

// ─── Review / Stage Modal ─────────────────────────────────────
function ReviewModal({ sub, onClose, onSaved }) {
  const { profile, session } = useAuth();
  const { register, handleSubmit, watch, formState: { isSubmitting } } = useForm({
    defaultValues: {
      stage:                  sub.stage,
      admin_feedback:         sub.admin_feedback ?? "",
      admin_feedback_visible: sub.admin_feedback_visible ?? false,
      rejection_reason:       sub.rejection_reason ?? "",
      internal_notes:         sub.internal_notes ?? "",
    },
  });
  const { register: regInt, handleSubmit: handleInt, reset: resetInt, formState: { isSubmitting: isScheduling } } = useForm({
    defaultValues: { interview_type: "video", duration_mins: 60, round_number: 1 }
  });
  const stage = watch("stage");
  const [serverError, setServerError] = useState("");
  const [interviews, setInterviews]   = useState([]);
  const [showIntForm, setShowIntForm] = useState(false);
  const [scoring, setScoring]         = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const field = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";

  useEffect(() => { loadInterviews(); }, []);

  async function loadInterviews() {
    const { data } = await supabase.from("interviews")
      .select("*").eq("submission_id", sub.id).order("round_number");
    setInterviews(data ?? []);
  }

  async function scheduleInterview(data) {
    const { error } = await supabase.from("interviews").insert({
      submission_id:    sub.id,
      round_number:     parseInt(data.round_number),
      interview_type:   data.interview_type,
      scheduled_at:     data.scheduled_at ? new Date(data.scheduled_at).toISOString() : null,
      duration_mins:    parseInt(data.duration_mins),
      interviewer_name: data.interviewer_name || null,
      location_or_link: data.location_or_link || null,
      instructions:     data.instructions || null,
      outcome:          "pending",
      scheduled_by:     profile.id,
    });
    if (error) { alert(error.message); return; }
    resetInt({ interview_type: "video", duration_mins: 60, round_number: (interviews.length + 2) });
    setShowIntForm(false);
    loadInterviews();
  }

  async function onSubmit(data) {
    setServerError("");
    const resp = await fetch(`${BACKEND_URL}/submissions/update-stage`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        submission_id:          sub.id,
        stage:                  data.stage,
        admin_feedback:         data.admin_feedback || null,
        admin_feedback_visible: data.admin_feedback_visible,
        rejection_reason:       data.rejection_reason || null,
        internal_notes:         data.internal_notes || null,
      }),
    });
    const json = await resp.json();
    if (!resp.ok) { setServerError(json.error ?? "Save failed"); return; }
    onSaved();
  }

  async function runMatchScore() {
    setScoring(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/match-score`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ submission_id: sub.id }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error ?? "Scoring failed");
      setMatchResult(json);
    } catch (err) {
      alert(err.message);
    }
    setScoring(false);
  }

  const currentScore = matchResult ?? (sub.match_score != null ? { score: sub.match_score, recommendation: sub.match_reasoning } : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Review Submission</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {sub.candidates?.first_name} {sub.candidates?.last_name} → {sub.jobs?.title}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Candidate summary */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex-shrink-0">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Vendor</p>
              <p className="text-gray-700 font-medium">{sub.vendors?.company_name}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Work Auth</p>
              <p className="text-gray-700">{sub.candidates?.work_authorization || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Experience</p>
              <p className="text-gray-700">{sub.candidates?.experience_years != null ? `${sub.candidates.experience_years} yrs` : "—"}</p>
            </div>
            {sub.candidates?.skills?.length > 0 && (
              <div className="col-span-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {sub.candidates.skills.map(s => (
                    <span key={s} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {sub.cover_note && (
              <div className="col-span-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Cover Note</p>
                <p className="text-gray-600 text-xs leading-relaxed">{sub.cover_note}</p>
              </div>
            )}
            <div className="col-span-3 flex gap-4 text-xs text-gray-500">
              {sub.bill_rate && <span>Bill: <b className="text-gray-700">${sub.bill_rate}/{sub.rate_type}</b></span>}
              {sub.pay_rate  && <span>Pay: <b className="text-gray-700">${sub.pay_rate}/{sub.rate_type}</b></span>}
              {sub.availability_date && <span>Available: <b className="text-gray-700">{new Date(sub.availability_date).toLocaleDateString()}</b></span>}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">

            {/* AI Match Score */}
            <div className="border border-indigo-100 bg-indigo-50/50 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-indigo-700 mb-1">AI Match Score</p>
                  {currentScore ? (
                    <div className="space-y-1">
                      <span className={`inline-block text-sm font-bold px-2.5 py-0.5 rounded-full ${scoreColor(currentScore.score)}`}>
                        {currentScore.score}/100
                      </span>
                      {currentScore.recommendation && (
                        <p className="text-xs text-gray-600 leading-relaxed">{currentScore.recommendation}</p>
                      )}
                      {matchResult?.strengths?.length > 0 && (
                        <p className="text-xs text-emerald-600">✓ {matchResult.strengths.join(" · ")}</p>
                      )}
                      {matchResult?.gaps?.length > 0 && (
                        <p className="text-xs text-red-500">✗ {matchResult.gaps.join(" · ")}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Not scored yet</p>
                  )}
                </div>
                <button type="button" onClick={runMatchScore} disabled={scoring}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-60">
                  {scoring ? <Loader className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                  {scoring ? "Scoring…" : currentScore ? "Re-score" : "Score"}
                </button>
              </div>
            </div>

            {/* Stage */}
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Pipeline Stage</label>
              <select {...register("stage")} className={field}>
                {ALL_STAGES.map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>

            {stage === "rejected" && (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Rejection Reason</label>
                <input {...register("rejection_reason")} placeholder="Skills mismatch, rate too high…" className={field} />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Feedback to Vendor</label>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" {...register("admin_feedback_visible")}
                    className="w-3.5 h-3.5 rounded accent-indigo-600" />
                  Visible to vendor
                </label>
              </div>
              <textarea {...register("admin_feedback")} rows={3}
                placeholder="Feedback shared with vendor when 'Visible to vendor' is checked…"
                className={field + " resize-none"} />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">
                Internal Notes <span className="normal-case font-normal text-gray-400">(never shown to vendor)</span>
              </label>
              <textarea {...register("internal_notes")} rows={2}
                placeholder="Private admin notes…"
                className={field + " resize-none"} />
            </div>

            {/* Interviews */}
            <div className="border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wide">Interviews</label>
                <button type="button" onClick={() => setShowIntForm(v => !v)}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                  <Plus className="w-3.5 h-3.5" /> Schedule
                </button>
              </div>

              {interviews.length > 0 && (
                <div className="space-y-2 mb-3">
                  {interviews.map(iv => (
                    <div key={iv.id} className="bg-gray-50 rounded-xl px-3 py-2.5 flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 capitalize">
                          Round {iv.round_number} — {iv.interview_type}
                        </p>
                        {iv.scheduled_at && (
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {new Date(iv.scheduled_at).toLocaleString("en-US", {
                              month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                            })}
                            {iv.duration_mins && ` · ${iv.duration_mins} min`}
                          </p>
                        )}
                        {iv.location_or_link && <p className="text-[11px] text-indigo-500 truncate">{iv.location_or_link}</p>}
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
              )}

              {showIntForm && (
                <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Type</label>
                      <select {...regInt("interview_type")} className={field}>
                        {["video","phone","onsite","technical","panel","hr"].map(t => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Round #</label>
                      <input type="number" min={1} {...regInt("round_number")} className={field} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Date & Time</label>
                      <input type="datetime-local" {...regInt("scheduled_at")} className={field} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Duration (min)</label>
                      <input type="number" {...regInt("duration_mins")} className={field} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Interviewer</label>
                      <input {...regInt("interviewer_name")} placeholder="John Doe" className={field} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Link / Location</label>
                      <input {...regInt("location_or_link")} placeholder="Zoom link or address" className={field} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Instructions</label>
                      <input {...regInt("instructions")} placeholder="What to prepare…" className={field} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowIntForm(false)}
                      className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-white">
                      Cancel
                    </button>
                    <button type="button" onClick={handleInt(scheduleInterview)} disabled={isScheduling}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-60">
                      {isScheduling ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                      Confirm Schedule
                    </button>
                  </div>
                </div>
              )}
            </div>

            {serverError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{serverError}</div>
            )}
          </div>

          <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {isSubmitting ? <><Loader className="w-4 h-4 animate-spin" /> Saving…</> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Submission Row ───────────────────────────────────────────
function SubRow({ sub, onReview }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="hover:bg-gray-50/50 transition-colors">
        <td className="px-5 py-3.5 cursor-pointer" onClick={() => setExpanded(v => !v)}>
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
        <td className="px-5 py-3.5 text-sm text-gray-700 max-w-[180px] truncate">{sub.jobs?.title}</td>
        <td className="px-5 py-3.5 text-sm text-gray-600">{sub.vendors?.company_name}</td>
        <td className="px-5 py-3.5">
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold capitalize
                           ${STAGE_BADGE[sub.stage] ?? "bg-gray-100 text-gray-500"}`}>
            {sub.stage?.replace(/_/g, " ")}
          </span>
        </td>
        <td className="px-4 py-3.5 text-center">
          {sub.match_score != null ? (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${scoreColor(sub.match_score)}`}>
              {sub.match_score}%
            </span>
          ) : (
            <span className="text-[10px] text-gray-300">—</span>
          )}
        </td>
        <td className="px-5 py-3.5 text-xs text-gray-400">
          {new Date(sub.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </td>
        <td className="px-5 py-3.5 text-right">
          <button onClick={() => onReview(sub)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 px-3 py-1.5
                       rounded-lg hover:bg-indigo-50 transition-colors">
            Review
          </button>
        </td>
      </tr>
      {expanded && sub.internal_notes && (
        <tr className="bg-yellow-50/50">
          <td colSpan={7} className="px-5 py-3">
            <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide mb-0.5">Internal Note</p>
            <p className="text-xs text-gray-600">{sub.internal_notes}</p>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [reviewing, setReviewing]     = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("submissions")
      .select(`
        *,
        jobs(title),
        vendors(company_name),
        candidates(first_name, last_name, current_title, work_authorization, experience_years, skills)
      `)
      .order("submitted_at", { ascending: false });
    setSubmissions(data ?? []);
    setLoading(false);
  }

  const filtered = submissions.filter(s => {
    const name = `${s.candidates?.first_name} ${s.candidates?.last_name}`.toLowerCase();
    const matchSearch = !search ||
      name.includes(search.toLowerCase()) ||
      s.jobs?.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.vendors?.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchStage = stageFilter === "all" || s.stage === stageFilter;
    return matchSearch && matchStage;
  });

  const counts = {};
  for (const s of submissions) counts[s.stage] = (counts[s.stage] ?? 0) + 1;

  const FILTER_TABS = [
    { key: "all",         label: "All" },
    { key: "submitted",   label: "New" },
    { key: "reviewing",   label: "Reviewing" },
    { key: "shortlisted", label: "Shortlisted" },
    { key: "placed",      label: "Placed" },
    { key: "rejected",    label: "Rejected" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
          <p className="text-sm text-gray-400 mt-0.5">{submissions.length} total across all vendors</p>
        </div>
        {filtered.length > 0 && (
          <button onClick={() => exportCSV(filtered)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {/* Stage tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setStageFilter(key)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors
                        ${stageFilter === key
                          ? "bg-indigo-600 text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}>
            {label}
            {counts[key] > 0 && key !== "all" && (
              <span className="ml-1 opacity-70">({counts[key]})</span>
            )}
            {key === "all" && <span className="ml-1 opacity-70">({submissions.length})</span>}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search candidate, job, or vendor…"
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
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Candidate</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Job</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Vendor</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Stage</th>
                <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Score</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Submitted</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(s => (
                <SubRow key={s.id} sub={s} onReview={setReviewing} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {reviewing && (
        <ReviewModal
          sub={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() => { setReviewing(null); load(); }}
        />
      )}
    </div>
  );
}

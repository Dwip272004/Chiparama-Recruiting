import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { JobDetailModal } from "../../components/JobDetailModal";
import {
  MapPin, Calendar, Clock, Users, AlertTriangle,
  Search, Briefcase, ChevronRight, Send, X, Loader, Plus
} from "lucide-react";

const WORK_BADGE = {
  onsite: "bg-emerald-100 text-emerald-700",
  remote: "bg-sky-100 text-sky-700",
  hybrid: "bg-violet-100 text-violet-700",
};

const PRIORITY_BADGE = {
  low:    "bg-gray-100 text-gray-500",
  normal: "bg-blue-50 text-blue-600",
  high:   "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function DeadlinePill({ deadline }) {
  if (!deadline) return null;
  const days = daysUntil(deadline);
  const color = days <= 0
    ? "bg-red-100 text-red-600"
    : days <= 3
    ? "bg-orange-100 text-orange-600"
    : days <= 7
    ? "bg-yellow-100 text-yellow-700"
    : "bg-gray-100 text-gray-500";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${color}`}>
      {days <= 0 ? "Overdue" : `${days}d left`}
    </span>
  );
}

// ─── Submit Candidate Modal ───────────────────────────────────
function SubmitModal({ job, assignment, vendorId, onClose, onSubmitted }) {
  const { profile } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    supabase.from("candidates").select("id, first_name, last_name, current_title, status")
      .eq("vendor_id", vendorId).eq("status", "active")
      .order("first_name")
      .then(({ data }) => { setCandidates(data ?? []); setLoadingCandidates(false); });
  }, [vendorId]);

  async function onSubmit(data) {
    setServerError("");
    const { error } = await supabase.from("submissions").insert({
      job_id:            job.id,
      candidate_id:      data.candidate_id,
      vendor_id:         vendorId,
      submitted_by:      profile.id,
      cover_note:        data.cover_note || null,
      availability_date: data.availability_date || null,
      bill_rate:         data.bill_rate ? parseFloat(data.bill_rate) : null,
      pay_rate:          data.pay_rate  ? parseFloat(data.pay_rate)  : null,
      rate_type:         data.rate_type || "hourly",
      stage:             "submitted",
    });
    if (error) { setServerError(error.message); return; }
    onSubmitted();
  }

  const field = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Submit Candidate</h2>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{job.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">

            {/* Candidate picker */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Select Candidate *
              </label>
              {loadingCandidates ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <Loader className="w-4 h-4 animate-spin" /> Loading candidates…
                </div>
              ) : candidates.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
                  No active candidates yet. <a href="/vendor/candidates" className="font-semibold underline">Add candidates</a> first.
                </div>
              ) : (
                <select {...register("candidate_id", { required: "Select a candidate" })} className={field}>
                  <option value="">Choose a candidate…</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}{c.current_title ? ` — ${c.current_title}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {errors.candidate_id && <p className="text-red-500 text-xs mt-0.5">{errors.candidate_id.message}</p>}
            </div>

            {/* Cover note */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Cover Note</label>
              <textarea {...register("cover_note")} rows={3}
                placeholder="Why is this candidate a great fit? Any highlights…"
                className={field + " resize-none"} />
            </div>

            {/* Availability + Rates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Available From</label>
                <input type="date" {...register("availability_date")} className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Rate Type</label>
                <select {...register("rate_type")} className={field}>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="annual">Annual</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Bill Rate ($)</label>
                <input type="number" step="0.01" {...register("bill_rate")} placeholder="75.00" className={field} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pay Rate ($)</label>
                <input type="number" step="0.01" {...register("pay_rate")} placeholder="55.00" className={field} />
              </div>
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
            <button type="submit" disabled={isSubmitting || candidates.length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {isSubmitting ? <><Loader className="w-4 h-4 animate-spin" /> Submitting…</> : <><Send className="w-4 h-4" /> Submit Candidate</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AssignedJobsPage() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [myCounts, setMyCounts]       = useState({});  // job_id → submission count
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [selectedJob, setSelectedJob] = useState(null);
  const [submitTarget, setSubmitTarget] = useState(null); // { job, assignment }

  useEffect(() => {
    if (profile?.vendor_id) load();
  }, [profile]);

  async function load() {
    const vendorId = profile.vendor_id;
    const [assignRes, countRes] = await Promise.all([
      supabase.from("job_vendor_assignments")
        .select("*, jobs(*)")
        .eq("vendor_id", vendorId)
        .eq("status", "active")
        .order("assigned_at", { ascending: false }),
      supabase.from("submissions")
        .select("job_id")
        .eq("vendor_id", vendorId),
    ]);

    setAssignments(assignRes.data ?? []);

    // Build submission count map
    const counts = {};
    for (const s of (countRes.data ?? [])) {
      counts[s.job_id] = (counts[s.job_id] ?? 0) + 1;
    }
    setMyCounts(counts);
    setLoading(false);
  }

  const filtered = assignments.filter(a =>
    !search ||
    a.jobs?.title?.toLowerCase().includes(search.toLowerCase()) ||
    a.jobs?.location_city?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assigned Jobs</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} active job{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search jobs…"
            className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm
                       focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-semibold text-gray-500">No jobs assigned yet</p>
          <p className="text-sm mt-1">Your admin will assign jobs to you shortly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(a => {
            const job       = a.jobs;
            const myCount   = myCounts[job?.id] ?? 0;
            const maxSubs   = a.max_submissions ?? 10;
            const pct       = Math.min(100, Math.round((myCount / maxSubs) * 100));
            const nearLimit = myCount >= maxSubs;
            const days      = daysUntil(a.deadline);

            return (
              <div key={a.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5
                           hover:shadow-md hover:border-indigo-200 transition-all duration-200 cursor-pointer group"
                onClick={() => setSelectedJob(job)}
              >
                {/* Row 1: avatar + badges */}
                <div className="flex items-start justify-between mb-3">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600
                                  flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-base">
                      {job?.title?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5 ml-2">
                    {a.priority !== "normal" && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize
                                       ${PRIORITY_BADGE[a.priority]}`}>
                        {a.priority}
                      </span>
                    )}
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold capitalize
                                     ${WORK_BADGE[job?.work_type] ?? "bg-gray-100 text-gray-500"}`}>
                      {job?.work_type}
                    </span>
                    {a.deadline && <DeadlinePill deadline={a.deadline} />}
                  </div>
                </div>

                {/* Title + company */}
                <h3 className="font-semibold text-gray-900 text-[15px] leading-snug mb-0.5
                               group-hover:text-indigo-600 transition-colors">
                  {job?.title}
                </h3>
                {job?.client_company && (
                  <p className="text-xs font-medium text-gray-400 mb-3">{job.client_company}</p>
                )}

                {/* Meta */}
                <div className="space-y-1.5 mb-4 text-xs text-gray-500">
                  {(job?.location_city || job?.location_state) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {[job.location_city, job.location_state].filter(Boolean).join(", ")}
                    </div>
                  )}
                  {job?.start_date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {new Date(job.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {job.end_date ? ` – ${new Date(job.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                    </div>
                  )}
                  {job?.schedule && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-gray-400" />
                      {job.schedule}
                    </div>
                  )}
                </div>

                {/* Submission progress */}
                <div className="pt-3 border-t border-gray-50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-500">
                      <span className={`font-semibold ${nearLimit ? "text-red-600" : "text-gray-700"}`}>
                        {myCount}
                      </span>
                      /{maxSubs} submissions
                    </span>
                    {nearLimit && (
                      <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
                        <AlertTriangle className="w-3 h-3" /> Limit reached
                      </span>
                    )}
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${nearLimit ? "bg-red-500" : "bg-indigo-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 gap-2">
                  <span className="text-xs text-gray-400 flex items-center gap-0.5 cursor-pointer hover:text-indigo-500"
                    onClick={() => setSelectedJob(job)}>
                    View JD <ChevronRight className="w-3 h-3" />
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); setSubmitTarget({ job, assignment: a }); }}
                    disabled={nearLimit}
                    className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg
                               bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40
                               disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-3 h-3" /> Submit
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedJob && (
        <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}

      {submitTarget && (
        <SubmitModal
          job={submitTarget.job}
          assignment={submitTarget.assignment}
          vendorId={profile.vendor_id}
          onClose={() => setSubmitTarget(null)}
          onSubmitted={() => { setSubmitTarget(null); load(); }}
        />
      )}
    </div>
  );
}

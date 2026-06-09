import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import {
  MapPin, Calendar, Users, X, Loader, Search,
  Plus, Check, Briefcase, Trash2, AlertTriangle
} from "lucide-react";

const WORK_BADGE = {
  onsite: "bg-emerald-100 text-emerald-700",
  remote: "bg-sky-100 text-sky-700",
  hybrid: "bg-violet-100 text-violet-700",
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001";

// ─── Create Job Modal ────────────────────────────────────────
function CreateJobModal({ onClose, onCreated }) {
  const { session } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { work_type: "onsite", employment_type: "contract", num_positions: 1 }
  });
  const [serverError, setServerError] = useState("");

  async function onSubmit(data) {
    setServerError("");
    const skills = data.top_skills
      ? data.top_skills.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    try {
      const res = await fetch(`${BACKEND_URL}/admin/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...data, top_skills: skills }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create job");
      onCreated();
    } catch (err) {
      setServerError(err.message);
    }
  }

  const field = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Add Job</h2>
            <p className="text-xs text-gray-400 mt-0.5">Create a job opening manually</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Job Title *</label>
            <input {...register("title", { required: "Required" })} placeholder="Senior Software Engineer" className={field} />
            {errors.title && <p className="text-red-500 text-xs mt-0.5">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">City</label>
              <input {...register("location_city")} placeholder="Austin" className={field} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">State</label>
              <input {...register("location_state")} placeholder="TX" className={field} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Work Type</label>
              <select {...register("work_type")} className={field}>
                <option value="onsite">Onsite</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Employment Type</label>
              <select {...register("employment_type")} className={field}>
                <option value="contract">Contract</option>
                <option value="fulltime">Full-time</option>
                <option value="contract_to_hire">Contract to Hire</option>
                <option value="parttime">Part-time</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Start Date</label>
              <input type="date" {...register("start_date")} className={field} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1"># Positions</label>
              <input type="number" min={1} {...register("num_positions")} className={field} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Key Skills (comma-separated)</label>
            <input {...register("top_skills")} placeholder="React, Node.js, AWS" className={field} />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Description</label>
            <textarea {...register("description")} rows={4}
              placeholder="Role overview, responsibilities, requirements…"
              className={field + " resize-none"} />
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{serverError}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {isSubmitting ? <><Loader className="w-4 h-4 animate-spin" /> Creating…</> : <><Plus className="w-4 h-4" /> Create Job</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Assign Vendors Modal ────────────────────────────────────
function AssignModal({ job, vendors, existingAssignments, onClose, onSaved }) {
  const { session } = useAuth();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm({
    defaultValues: { priority: "normal", max_submissions: 10 }
  });
  const [selected, setSelected]       = useState(new Set(existingAssignments.map(a => a.vendor_id)));
  const [serverError, setServerError] = useState("");

  function toggle(vendorId) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(vendorId) ? next.delete(vendorId) : next.add(vendorId);
      return next;
    });
  }

  async function onSubmit(formData) {
    setServerError("");
    try {
      const res = await fetch(`${BACKEND_URL}/admin/assign-job`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          job_id:          job.id,
          vendor_ids:      [...selected],
          deadline:        formData.deadline || null,
          max_submissions: parseInt(formData.max_submissions) || 10,
          priority:        formData.priority,
          instructions:    formData.instructions || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save assignments");
      onSaved();
    } catch (err) {
      setServerError(err.message);
    }
  }

  const field = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Assign Vendors</h2>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{job.title}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-6 space-y-5 flex-1">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                Select Vendors ({selected.size} selected)
              </p>
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {vendors.filter(v => v.status === "active").map(vendor => (
                  <label key={vendor.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all
                                ${selected.has(vendor.id) ? "border-indigo-300 bg-indigo-50" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors
                                    ${selected.has(vendor.id) ? "bg-indigo-600 border-indigo-600" : "border-gray-300"}`}>
                      {selected.has(vendor.id) && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <input type="checkbox" className="sr-only" checked={selected.has(vendor.id)} onChange={() => toggle(vendor.id)} />
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{vendor.company_name[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{vendor.company_name}</p>
                      <p className="text-xs text-gray-400">{vendor.primary_contact}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Deadline</label>
                <input type="date" {...register("deadline")} className={field} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Max Submissions</label>
                <input type="number" {...register("max_submissions")} min={1} max={50} className={field} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Priority</label>
                <select {...register("priority")} className={field}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div />
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Instructions to vendors (private)</label>
                <textarea {...register("instructions")} rows={2}
                  placeholder="Specific requirements, rate budget, client notes…"
                  className={field + " resize-none"} />
              </div>
            </div>
            {serverError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{serverError}</div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting || selected.size === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {isSubmitting ? <><Loader className="w-4 h-4 animate-spin" /> Saving…</> : `Assign to ${selected.size} vendor${selected.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function JobAssignPage() {
  const { session }                   = useAuth();
  const [jobs, setJobs]               = useState([]);
  const [vendors, setVendors]         = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [showAll, setShowAll]         = useState(false);
  const [activeJob, setActiveJob]     = useState(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [closingId, setClosingId]     = useState(null); // confirm state

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [jobsRes, vendorsRes, assignRes] = await Promise.all([
      supabase.from("jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("vendors").select("*").eq("status", "active").order("company_name"),
      supabase.from("job_vendor_assignments").select("*, vendors(company_name)"),
    ]);
    setJobs(jobsRes.data ?? []);
    setVendors(vendorsRes.data ?? []);
    setAssignments(assignRes.data ?? []);
    setLoading(false);
  }

  async function closeJob(id) {
    await fetch(`${BACKEND_URL}/admin/jobs/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    setClosingId(null);
    fetchAll();
  }

  const visible = jobs.filter(j => showAll ? true : j.status === "active");
  const filtered = visible.filter(j =>
    !search ||
    j.title?.toLowerCase().includes(search.toLowerCase()) ||
    j.location_city?.toLowerCase().includes(search.toLowerCase())
  );

  function jobAssignments(jobId) {
    return assignments.filter(a => a.job_id === jobId);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-400 mt-0.5">Assign vendors to active jobs</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs…"
              className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white" />
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Job
          </button>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        <button onClick={() => setShowAll(false)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors
                      ${!showAll ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}>
          Active ({jobs.filter(j => j.status === "active").length})
        </button>
        <button onClick={() => setShowAll(true)}
          className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors
                      ${showAll ? "bg-indigo-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-indigo-300"}`}>
          All ({jobs.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-20 text-gray-400">
          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{search ? "No jobs match" : "No jobs yet"}</p>
          {!search && <p className="text-sm mt-1">Click "Add Job" or wait for an email JD to be parsed</p>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Job</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Location</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Assigned Vendors</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(job => {
                const jobAssigns = jobAssignments(job.id);
                const isClosed   = job.status === "closed";
                return (
                  <tr key={job.id} className={`hover:bg-gray-50/50 transition-colors ${isClosed ? "opacity-50" : ""}`}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-800">{job.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {!isClosed ? (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize
                                           ${WORK_BADGE[job.work_type] ?? "bg-gray-100 text-gray-500"}`}>
                            {job.work_type}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500">
                            Closed
                          </span>
                        )}
                        {job.start_date && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(job.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {[job.location_city, job.location_state].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="px-5 py-4">
                      {jobAssigns.length === 0 ? (
                        <span className="text-xs text-gray-400">Not assigned</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {jobAssigns.map(a => (
                            <span key={a.id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
                              {a.vendors?.company_name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!isClosed && (
                          <button onClick={() => setActiveJob(job)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600
                                       hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors">
                            <Users className="w-3.5 h-3.5" />
                            {jobAssigns.length > 0 ? "Edit" : "Assign"}
                          </button>
                        )}
                        {closingId === job.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">Close job?</span>
                            <button onClick={() => closeJob(job.id)}
                              className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50">
                              Yes
                            </button>
                            <button onClick={() => setClosingId(null)}
                              className="text-xs font-medium text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100">
                              No
                            </button>
                          </div>
                        ) : !isClosed ? (
                          <button onClick={() => setClosingId(job.id)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Close job">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateJobModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchAll(); }}
        />
      )}

      {activeJob && (
        <AssignModal
          job={activeJob}
          vendors={vendors}
          existingAssignments={jobAssignments(activeJob.id)}
          onClose={() => setActiveJob(null)}
          onSaved={() => { setActiveJob(null); fetchAll(); }}
        />
      )}
    </div>
  );
}

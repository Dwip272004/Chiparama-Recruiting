import { useState, useEffect, useMemo } from "react";
import { Search, SlidersHorizontal, X, Briefcase, MapPin, Wifi } from "lucide-react";
import { supabase } from "../lib/supabase";
import { JobCard } from "./JobCard";
import { JobDetailModal } from "./JobDetailModal";

// ─── Filter options ──────────────────────────────────────────
const WORK_TYPES       = ["all", "onsite", "remote", "hybrid"];
const EMPLOYMENT_TYPES = ["all", "contract", "full-time", "part-time", "contract-to-hire"];

function capitalize(s = "") {
  return s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("-");
}

// ─── Skeleton card ───────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="w-11 h-11 bg-gray-200 rounded-xl" />
        <div className="w-16 h-5 bg-gray-100 rounded-full" />
      </div>
      <div className="h-4 bg-gray-200 rounded w-4/5 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
      <div className="h-3 bg-gray-100 rounded w-3/4 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-2/3 mb-4" />
      <div className="flex gap-1.5">
        <div className="h-5 w-16 bg-gray-100 rounded-full" />
        <div className="h-5 w-20 bg-gray-100 rounded-full" />
        <div className="h-5 w-14 bg-gray-100 rounded-full" />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
export function JobBoard() {
  const [jobs, setJobs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter state
  const [search, setSearch]             = useState("");
  const [workType, setWorkType]         = useState("all");
  const [employment, setEmployment]     = useState("all");
  const [locationSearch, setLocation]   = useState("");

  useEffect(() => {
    async function fetchJobs() {
      setLoading(true);
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setJobs(data ?? []);
      }
      setLoading(false);
    }
    fetchJobs();
  }, []);

  // ── Client-side filtering ────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return jobs.filter(job => {
      const matchSearch =
        !q ||
        job.title?.toLowerCase().includes(q) ||
        job.client_company?.toLowerCase().includes(q) ||
        job.industry?.toLowerCase().includes(q) ||
        job.tags?.some(t => t.toLowerCase().includes(q)) ||
        job.top_skills?.some(s => s.toLowerCase().includes(q));

      const matchWork       = workType   === "all" || job.work_type      === workType;
      const matchEmployment = employment === "all" || job.employment_type === employment;

      const lq = locationSearch.toLowerCase();
      const matchLocation =
        !lq ||
        job.location_city?.toLowerCase().includes(lq) ||
        job.location_state?.toLowerCase().includes(lq);

      return matchSearch && matchWork && matchEmployment && matchLocation;
    });
  }, [jobs, search, workType, employment, locationSearch]);

  // ── Derived stats ────────────────────────────────────────
  const stats = useMemo(() => ({
    total:   jobs.length,
    remote:  jobs.filter(j => j.work_type === "remote").length,
    onsite:  jobs.filter(j => j.work_type === "onsite").length,
    cities:  new Set(jobs.map(j => j.location_city).filter(Boolean)).size,
  }), [jobs]);

  const activeFilterCount =
    (workType !== "all" ? 1 : 0) +
    (employment !== "all" ? 1 : 0) +
    (locationSearch ? 1 : 0);

  function clearFilters() {
    setWorkType("all");
    setEmployment("all");
    setLocation("");
  }

  // ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header / Hero ── */}
      <header className="bg-gradient-to-br from-indigo-950 via-indigo-800 to-indigo-700 text-white
                          pt-12 pb-14 px-6 relative overflow-hidden">
        {/* decorative blobs */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-indigo-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-xl tracking-tight">TalentBoard</span>
          </div>
          <p className="text-indigo-300 text-sm mb-8">
            AI-parsed job marketplace · updated automatically
          </p>

          {/* Search */}
          <div className="flex gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search title, skill, company, tag…"
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-gray-800 bg-white
                           shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setFiltersOpen(v => !v)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-medium text-sm
                          border transition-all shadow-lg
                          ${filtersOpen
                            ? "bg-white text-indigo-700 border-white"
                            : "bg-white/10 text-white border-white/20 hover:bg-white/20"}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-indigo-600 text-white text-[10px] w-4 h-4 rounded-full
                                 flex items-center justify-center font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Stats bar */}
          <div className="flex gap-6 mt-6 text-xs text-indigo-300">
            <span><span className="text-white font-semibold">{stats.total}</span> total jobs</span>
            <span><span className="text-white font-semibold">{stats.onsite}</span> onsite</span>
            <span><span className="text-white font-semibold">{stats.remote}</span> remote</span>
            <span><span className="text-white font-semibold">{stats.cities}</span> cities</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* ── Inline filter bar (toggled) ── */}
        {filtersOpen && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6
                          flex flex-wrap gap-6 items-end">
            {/* Work type */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Work Type
              </label>
              <div className="flex flex-wrap gap-1.5">
                {WORK_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setWorkType(type)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all
                               ${workType === type
                                 ? "bg-indigo-600 text-white shadow-sm"
                                 : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {type === "all" ? "All" : capitalize(type)}
                  </button>
                ))}
              </div>
            </div>

            {/* Employment */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Employment
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EMPLOYMENT_TYPES.map(type => (
                  <button
                    key={type}
                    onClick={() => setEmployment(type)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all
                               ${employment === type
                                 ? "bg-indigo-600 text-white shadow-sm"
                                 : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {type === "all" ? "All" : capitalize(type)}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={locationSearch}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="City or state…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm
                             focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>

            {/* Clear */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 self-end pb-0.5"
              >
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
          </div>
        )}

        {/* ── Results header ── */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-800">{filtered.length}</span> of{" "}
            <span className="font-semibold text-gray-800">{jobs.length}</span> jobs
          </p>
        </div>

        {/* ── Error state ── */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 mb-6 text-sm">
            Failed to load jobs: {error}
          </div>
        )}

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <div className="text-6xl mb-5">🔍</div>
            <p className="text-xl font-semibold text-gray-500">No jobs match your search</p>
            <p className="text-sm mt-2">Try broadening your filters or search terms</p>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="mt-4 text-sm text-indigo-500 hover:underline">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(job => (
              <JobCard key={job.id} job={job} onClick={() => setSelectedJob(job)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Detail modal ── */}
      {selectedJob && (
        <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      )}
    </div>
  );
}

import {
  X, MapPin, Calendar, Clock, Users, Building,
  AlertTriangle, CheckCircle, Tag, Briefcase, ChevronRight
} from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────
function fmtDateLong(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric"
  });
}

const WORK_TYPE_STYLES = {
  onsite: "bg-emerald-100/80 text-emerald-700 border-emerald-200",
  remote: "bg-sky-100/80 text-sky-700 border-sky-200",
  hybrid: "bg-violet-100/80 text-violet-700 border-violet-200",
};

// ─── Section heading ─────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </h3>
  );
}

// ─── Sidebar detail row ──────────────────────────────────────
function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-indigo-500" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="text-sm text-gray-700">{children}</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
export function JobDetailModal({ job, onClose }) {
  const displayName = job.client_company || job.title || "";
  const initial     = displayName[0]?.toUpperCase() ?? "?";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* ── Modal Header ── */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-indigo-700 text-white px-6 py-5 flex-shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center
                              text-2xl font-extrabold flex-shrink-0 ring-1 ring-white/20">
                {initial}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold leading-tight">{job.title}</h2>
                {job.client_company && (
                  <p className="text-indigo-200 text-sm font-medium mt-0.5">{job.client_company}</p>
                )}
                <div className="flex items-center gap-1 text-indigo-300/70 text-xs mt-1">
                  {job.job_reference_id && <span>Ref #{job.job_reference_id}</span>}
                  {job.job_reference_id && job.source_system && <ChevronRight className="w-3 h-3" />}
                  {job.source_system && <span>{job.source_system}</span>}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Badge row */}
          <div className="flex flex-wrap gap-2 mt-4">
            <span className={`text-xs px-3 py-1 rounded-full font-semibold border capitalize
                             ${WORK_TYPE_STYLES[job.work_type] ?? "bg-white/10 text-white border-white/20"}`}>
              {job.work_type}
            </span>
            <span className="text-xs px-3 py-1 rounded-full font-semibold bg-white/10
                             text-indigo-100 border border-white/20 capitalize">
              {job.employment_type}
            </span>
            {job.industry && (
              <span className="text-xs px-3 py-1 rounded-full font-semibold bg-white/10
                               text-indigo-100 border border-white/20">
                {job.industry}
              </span>
            )}
            {job.num_positions > 1 && (
              <span className="text-xs px-3 py-1 rounded-full font-semibold bg-white/10
                               text-indigo-100 border border-white/20">
                {job.num_positions} openings
              </span>
            )}
          </div>
        </div>

        {/* ── Modal Body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3">

            {/* Left: main content */}
            <div className="lg:col-span-2 p-6 space-y-7 border-r border-gray-100">

              {/* Special requirements banner */}
              {job.special_requirements?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="font-bold text-amber-700 text-sm">Special Requirements</span>
                  </div>
                  <ul className="space-y-1">
                    {job.special_requirements.map((req, i) => (
                      <li key={i} className="text-sm text-amber-700 font-medium flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Overview */}
              {job.description && (
                <section>
                  <SectionTitle>Overview</SectionTitle>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{job.description}</p>
                </section>
              )}

              {/* Top Skills */}
              {job.top_skills?.length > 0 && (
                <section>
                  <SectionTitle>Top Skills</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {job.top_skills.map((skill, i) => (
                      <span key={i}
                        className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100
                                   px-3 py-1 rounded-full font-medium">
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Responsibilities */}
              {job.responsibilities?.length > 0 && (
                <section>
                  <SectionTitle>Responsibilities</SectionTitle>
                  <ul className="space-y-2.5">
                    {job.responsibilities.map((r, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Qualifications */}
              {job.qualifications?.length > 0 && (
                <section>
                  <SectionTitle>Qualifications</SectionTitle>
                  <ul className="space-y-2.5">
                    {job.qualifications.map((q, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mt-1.5" />
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Tags */}
              {job.tags?.length > 0 && (
                <section>
                  <SectionTitle>
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3 h-3" /> Tags
                    </span>
                  </SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {job.tags.map((tag, i) => (
                      <span key={i}
                        className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right: sidebar details */}
            <div className="p-6 bg-gray-50/60 space-y-5">
              <SectionTitle>Job Details</SectionTitle>

              {(job.location_city || job.location_full_address) && (
                <DetailRow icon={MapPin} label="Location">
                  <span className="font-semibold">
                    {[job.location_city, job.location_state].filter(Boolean).join(", ")}
                  </span>
                  {job.location_full_address && (
                    <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                      {job.location_full_address}
                    </p>
                  )}
                </DetailRow>
              )}

              {(job.start_date || job.end_date) && (
                <DetailRow icon={Calendar} label="Duration">
                  {job.start_date && (
                    <p><span className="font-medium">Start:</span> {fmtDateLong(job.start_date)}</p>
                  )}
                  {job.end_date && (
                    <p><span className="font-medium">End:</span> {fmtDateLong(job.end_date)}</p>
                  )}
                </DetailRow>
              )}

              {job.schedule && (
                <DetailRow icon={Clock} label="Schedule">
                  <span>{job.schedule}</span>
                </DetailRow>
              )}

              {job.num_positions && (
                <DetailRow icon={Users} label="Openings">
                  <span className="font-semibold">
                    {job.num_positions} position{job.num_positions !== 1 ? "s" : ""}
                  </span>
                </DetailRow>
              )}

              {job.experience_years_min != null && (
                <DetailRow icon={Briefcase} label="Experience">
                  <span className="font-semibold">
                    {job.experience_years_min}
                    {job.experience_years_max ? `–${job.experience_years_max}` : "+"} years
                  </span>
                </DetailRow>
              )}

              {job.source_system && (
                <DetailRow icon={Building} label="ATS System">
                  <span>{job.source_system}</span>
                </DetailRow>
              )}

              {/* Listed date */}
              {job.created_at && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-400 text-center">
                    Listed{" "}
                    {new Date(job.created_at).toLocaleDateString("en-US", {
                      month: "long", day: "numeric", year: "numeric"
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

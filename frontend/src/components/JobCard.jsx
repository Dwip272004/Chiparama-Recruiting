import { MapPin, Calendar, Briefcase, AlertTriangle, Users } from "lucide-react";

// ─── Badge color maps ───────────────────────────────────────
const WORK_TYPE_BADGE = {
  onsite:  "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  remote:  "bg-sky-100 text-sky-700 ring-1 ring-sky-200",
  hybrid:  "bg-violet-100 text-violet-700 ring-1 ring-violet-200",
};

const EMPLOYMENT_BADGE = {
  "contract":         "bg-orange-100 text-orange-700",
  "full-time":        "bg-teal-100 text-teal-700",
  "part-time":        "bg-amber-100 text-amber-700",
  "contract-to-hire": "bg-pink-100 text-pink-700",
  "unknown":          "bg-gray-100 text-gray-500",
};

// Deterministic gradient per company initial so cards look varied
const AVATAR_GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-sky-500 to-cyan-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-fuchsia-600",
];

function avatarGradient(str = "") {
  const code = (str.charCodeAt(0) || 0) + (str.charCodeAt(1) || 0);
  return AVATAR_GRADIENTS[code % AVATAR_GRADIENTS.length];
}

function fmtDateShort(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function JobCard({ job, onClick }) {
  const displayName = job.client_company || job.title || "?";
  const initial = displayName[0].toUpperCase();
  const gradient = avatarGradient(displayName);
  const locationStr = [job.location_city, job.location_state].filter(Boolean).join(", ");

  return (
    <article
      onClick={onClick}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer flex flex-col
                 transition-all duration-200 hover:shadow-lg hover:border-indigo-200 hover:-translate-y-0.5"
      aria-label={`View ${job.title}`}
    >
      {/* ── Row 1: Avatar + badges ── */}
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center
                         text-white font-bold text-base flex-shrink-0 shadow-sm`}>
          {initial}
        </div>

        <div className="flex flex-wrap justify-end gap-1.5 ml-2">
          {job.special_requirements?.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] bg-red-50 text-red-500 px-2 py-0.5 rounded-full font-medium ring-1 ring-red-200">
              <AlertTriangle className="w-3 h-3" /> Reqs
            </span>
          )}
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold capitalize
                           ${WORK_TYPE_BADGE[job.work_type] ?? "bg-gray-100 text-gray-500"}`}>
            {job.work_type}
          </span>
        </div>
      </div>

      {/* ── Row 2: Title + Company ── */}
      <h3 className="font-semibold text-gray-900 text-[15px] leading-snug mb-0.5
                     group-hover:text-indigo-600 transition-colors line-clamp-2">
        {job.title}
      </h3>
      {job.client_company && (
        <p className="text-xs font-medium text-gray-500 mb-3">{job.client_company}</p>
      )}

      {/* ── Row 3: Meta info ── */}
      <div className="space-y-1.5 mb-3 flex-1 text-xs text-gray-500">
        {locationStr && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            <span>{locationStr}</span>
          </div>
        )}
        {job.start_date && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            <span>
              {fmtDateShort(job.start_date)}
              {job.end_date ? ` – ${fmtDateShort(job.end_date)}` : ""}
            </span>
          </div>
        )}
        {job.experience_years_min != null && (
          <div className="flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            <span>{job.experience_years_min}+ yrs experience</span>
          </div>
        )}
        {job.num_positions > 1 && (
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
            <span>{job.num_positions} openings</span>
          </div>
        )}
      </div>

      {/* ── Row 4: Skill chips ── */}
      {job.top_skills?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {job.top_skills.slice(0, 3).map((skill, i) => (
            <span key={i} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {skill.length > 28 ? skill.slice(0, 28) + "…" : skill}
            </span>
          ))}
          {job.top_skills.length > 3 && (
            <span className="text-[11px] text-indigo-400 font-medium self-center">
              +{job.top_skills.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* ── Row 5: Footer ── */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-50">
        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold capitalize
                         ${EMPLOYMENT_BADGE[job.employment_type] ?? "bg-gray-100 text-gray-500"}`}>
          {job.employment_type}
        </span>
        {job.job_reference_id && (
          <span className="text-[11px] text-gray-300 font-mono">#{job.job_reference_id}</span>
        )}
      </div>
    </article>
  );
}

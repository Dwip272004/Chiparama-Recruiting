import { useState } from "react";
import { X, Save, Loader, ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabase";

// ─── Helpers ────────────────────────────────────────────────
const toLines  = (arr) => (arr ?? []).join("\n");
const toArray  = (str) => str.split("\n").map(s => s.trim()).filter(Boolean);
const toIntOrNull = (v) => (v === "" || v == null) ? null : parseInt(v);

// ─── Reusable form primitives ────────────────────────────────
function Label({ children }) {
  return <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{children}</label>;
}

function Input({ name, value, onChange, type = "text", placeholder, className = "" }) {
  return (
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full border border-gray-200 rounded-xl px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400
                  bg-white text-gray-800 ${className}`}
    />
  );
}

function Textarea({ name, value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm
                 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400
                 bg-white text-gray-800 resize-y"
    />
  );
}

function Select({ name, value, onChange, options }) {
  return (
    <div className="relative">
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm appearance-none
                   focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400
                   bg-white text-gray-800 pr-8"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 pt-2
                   border-t border-gray-100 first:border-t-0 first:pt-0">
      {children}
    </h3>
  );
}

// ────────────────────────────────────────────────────────────
export function EditJobModal({ job, onClose, onSave }) {
  const [form, setForm] = useState({
    title:                job.title                ?? "",
    client_company:       job.client_company       ?? "",
    num_positions:        job.num_positions        ?? 1,
    employment_type:      job.employment_type      ?? "contract",
    work_type:            job.work_type            ?? "onsite",
    status:               job.status               ?? "active",
    industry:             job.industry             ?? "",
    location_full_address:job.location_full_address ?? "",
    location_street:      job.location_street      ?? "",
    location_city:        job.location_city        ?? "",
    location_state:       job.location_state       ?? "",
    location_country:     job.location_country     ?? "",
    location_zip:         job.location_zip         ?? "",
    start_date:           job.start_date           ?? "",
    end_date:             job.end_date             ?? "",
    schedule:             job.schedule             ?? "",
    description:          job.description          ?? "",
    experience_years_min: job.experience_years_min ?? "",
    experience_years_max: job.experience_years_max ?? "",
    source_system:        job.source_system        ?? "",
    // Arrays stored as newline-separated strings for easy editing
    top_skills:           toLines(job.top_skills),
    responsibilities:     toLines(job.responsibilities),
    qualifications:       toLines(job.qualifications),
    special_requirements: toLines(job.special_requirements),
    tags:                 toLines(job.tags),
  });

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSave() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError(null);

    const updates = {
      title:                form.title.trim(),
      client_company:       form.client_company.trim()        || null,
      num_positions:        parseInt(form.num_positions)      || 1,
      employment_type:      form.employment_type,
      work_type:            form.work_type,
      status:               form.status,
      industry:             form.industry.trim()              || null,
      location_full_address:form.location_full_address.trim() || null,
      location_street:      form.location_street.trim()       || null,
      location_city:        form.location_city.trim()         || null,
      location_state:       form.location_state.trim()        || null,
      location_country:     form.location_country.trim()      || null,
      location_zip:         form.location_zip.trim()          || null,
      start_date:           form.start_date                   || null,
      end_date:             form.end_date                     || null,
      schedule:             form.schedule.trim()              || null,
      description:          form.description.trim()           || null,
      experience_years_min: toIntOrNull(form.experience_years_min),
      experience_years_max: toIntOrNull(form.experience_years_max),
      source_system:        form.source_system.trim()         || null,
      top_skills:           toArray(form.top_skills),
      responsibilities:     toArray(form.responsibilities),
      qualifications:       toArray(form.qualifications),
      special_requirements: toArray(form.special_requirements),
      tags:                 toArray(form.tags),
    };

    const { data, error: sbError } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", job.id)
      .select()
      .single();

    setSaving(false);

    if (sbError) { setError(sbError.message); return; }
    onSave(data);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh]
                      overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Edit Job</h2>
            <p className="text-xs text-gray-400 mt-0.5">#{job.job_reference_id} · {job.id.slice(0, 8)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── Core Info ── */}
          <SectionTitle>Core Info</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Job Title *</Label>
              <Input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Electronics Lab Technician" />
            </div>
            <div>
              <Label>Client Company</Label>
              <Input name="client_company" value={form.client_company} onChange={handleChange} placeholder="End-client employer" />
            </div>
            <div>
              <Label>Industry</Label>
              <Input name="industry" value={form.industry} onChange={handleChange} placeholder="e.g. Automotive Electronics" />
            </div>
            <div>
              <Label>Positions</Label>
              <Input name="num_positions" value={form.num_positions} onChange={handleChange} type="number" />
            </div>
            <div>
              <Label>Status</Label>
              <Select name="status" value={form.status} onChange={handleChange}
                options={[
                  { value: "active",  label: "Active" },
                  { value: "filled",  label: "Filled" },
                  { value: "expired", label: "Expired" },
                  { value: "draft",   label: "Draft" },
                ]}
              />
            </div>
            <div>
              <Label>Work Type</Label>
              <Select name="work_type" value={form.work_type} onChange={handleChange}
                options={[
                  { value: "onsite", label: "Onsite" },
                  { value: "remote", label: "Remote" },
                  { value: "hybrid", label: "Hybrid" },
                ]}
              />
            </div>
            <div>
              <Label>Employment Type</Label>
              <Select name="employment_type" value={form.employment_type} onChange={handleChange}
                options={[
                  { value: "contract",         label: "Contract" },
                  { value: "full-time",         label: "Full-time" },
                  { value: "part-time",         label: "Part-time" },
                  { value: "contract-to-hire",  label: "Contract-to-hire" },
                  { value: "unknown",           label: "Unknown" },
                ]}
              />
            </div>
          </div>

          {/* ── Location ── */}
          <SectionTitle>Location</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Full Address</Label>
              <Input name="location_full_address" value={form.location_full_address} onChange={handleChange} placeholder="850 Hansen Way, Palo Alto, CA 94304" />
            </div>
            <div>
              <Label>City</Label>
              <Input name="location_city" value={form.location_city} onChange={handleChange} placeholder="Palo Alto" />
            </div>
            <div>
              <Label>State</Label>
              <Input name="location_state" value={form.location_state} onChange={handleChange} placeholder="California" />
            </div>
            <div>
              <Label>Country</Label>
              <Input name="location_country" value={form.location_country} onChange={handleChange} placeholder="United States" />
            </div>
            <div>
              <Label>ZIP</Label>
              <Input name="location_zip" value={form.location_zip} onChange={handleChange} placeholder="94304" />
            </div>
          </div>

          {/* ── Timeline ── */}
          <SectionTitle>Timeline</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input name="start_date" value={form.start_date} onChange={handleChange} type="date" />
            </div>
            <div>
              <Label>End Date</Label>
              <Input name="end_date" value={form.end_date} onChange={handleChange} type="date" />
            </div>
            <div>
              <Label>Schedule</Label>
              <Input name="schedule" value={form.schedule} onChange={handleChange} placeholder="M–F 8–5" />
            </div>
          </div>

          {/* ── Experience ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Min Experience (yrs)</Label>
              <Input name="experience_years_min" value={form.experience_years_min} onChange={handleChange} type="number" placeholder="e.g. 3" />
            </div>
            <div>
              <Label>Max Experience (yrs)</Label>
              <Input name="experience_years_max" value={form.experience_years_max} onChange={handleChange} type="number" placeholder="e.g. 7" />
            </div>
          </div>

          {/* ── Description ── */}
          <SectionTitle>Description</SectionTitle>
          <Textarea name="description" value={form.description} onChange={handleChange}
            placeholder="Narrative job description…" rows={5} />

          {/* ── Lists ── */}
          <SectionTitle>Skills, Responsibilities & Qualifications</SectionTitle>
          <p className="text-xs text-gray-400 -mt-3 mb-3">One item per line for all list fields below.</p>

          <div>
            <Label>Top Skills</Label>
            <Textarea name="top_skills" value={form.top_skills} onChange={handleChange}
              placeholder={"Operate test equipment\nTroubleshoot DUT failures\nCircuit board rework"} rows={4} />
          </div>
          <div>
            <Label>Responsibilities</Label>
            <Textarea name="responsibilities" value={form.responsibilities} onChange={handleChange}
              placeholder="One responsibility per line…" rows={5} />
          </div>
          <div>
            <Label>Qualifications</Label>
            <Textarea name="qualifications" value={form.qualifications} onChange={handleChange}
              placeholder="One qualification per line…" rows={5} />
          </div>

          {/* ── Other ── */}
          <SectionTitle>Other</SectionTitle>
          <div>
            <Label>Special Requirements</Label>
            <Textarea name="special_requirements" value={form.special_requirements} onChange={handleChange}
              placeholder={"MUST PASS MVR CHECK\n100% ONSITE"} rows={2} />
          </div>
          <div>
            <Label>Tags</Label>
            <Textarea name="tags" value={form.tags} onChange={handleChange}
              placeholder={"ECU\nADAS\nAutomotive\nEmbedded Systems"} rows={3} />
          </div>
          <div>
            <Label>ATS / Source System</Label>
            <Input name="source_system" value={form.source_system} onChange={handleChange} placeholder="Workday VNDLY" />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600
                       hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold
                       bg-indigo-600 text-white hover:bg-indigo-700 transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

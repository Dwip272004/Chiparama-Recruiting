import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import {
  Plus, Search, X, Loader, Users, Mail, Phone,
  ChevronDown, ChevronUp, Edit2, Upload, FileText,
  Sparkles, ExternalLink, FileUp, AlertCircle, CheckCircle2
} from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001";

const WORK_AUTH = ["US Citizen", "Green Card", "H1B", "OPT", "EAD", "Other"];
const STATUS_BADGE = {
  active:          "bg-emerald-100 text-emerald-700",
  inactive:        "bg-gray-100 text-gray-500",
  placed:          "bg-blue-100 text-blue-700",
  blacklisted:     "bg-red-100 text-red-600",
  do_not_contact:  "bg-orange-100 text-orange-600",
};

// ─── CSV column name aliases (case-insensitive) ───────────────
const CSV_MAP = {
  first_name:         ["first name","firstname","first"],
  last_name:          ["last name","lastname","last","surname"],
  email:              ["email","e-mail"],
  phone:              ["phone","mobile","contact"],
  city:               ["city"],
  state:              ["state","province"],
  work_authorization: ["work auth","work authorization","visa","visa status"],
  current_title:      ["title","current title","job title","position"],
  current_company:    ["company","current company","employer"],
  experience_years:   ["experience","years","exp","experience years","years of experience"],
  skills:             ["skills","skill set","technologies"],
  summary:            ["summary","bio","about"],
};

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim().toLowerCase());

  // Map CSV header index → candidate field
  const colMap = {};
  headers.forEach((h, i) => {
    for (const [field, aliases] of Object.entries(CSV_MAP)) {
      if (aliases.includes(h)) { colMap[i] = field; break; }
    }
  });

  return lines.slice(1).map(line => {
    // Handle quoted commas
    const cols = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { cols.push(cur); cur = ""; }
      else cur += ch;
    }
    cols.push(cur);

    const row = {};
    cols.forEach((val, i) => {
      if (colMap[i]) row[colMap[i]] = val.trim();
    });
    return row;
  }).filter(r => r.first_name || r.last_name || r.email);
}

// ─── CSV Import Modal ─────────────────────────────────────────
function CsvImportModal({ vendorId, profileId, onClose, onImported }) {
  const [rows, setRows]         = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImport]  = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const fileRef = useRef();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setError("");
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target.result);
      if (parsed.length === 0) {
        setError("No valid rows found. Make sure your CSV has First Name / Last Name / Email columns.");
        setRows([]);
      } else {
        setRows(parsed);
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImport(true);
    const payload = rows.map(r => ({
      first_name:         r.first_name || null,
      last_name:          r.last_name  || null,
      email:              r.email      || null,
      phone:              r.phone      || null,
      city:               r.city       || null,
      state:              r.state      || null,
      work_authorization: r.work_authorization || null,
      current_title:      r.current_title      || null,
      current_company:    r.current_company    || null,
      experience_years:   r.experience_years ? parseInt(r.experience_years) || null : null,
      skills:             r.skills ? r.skills.split(/[;,]/).map(s => s.trim()).filter(Boolean) : [],
      summary:            r.summary || null,
      vendor_id:          vendorId,
      added_by:           profileId,
    }));

    const { data, error: err } = await supabase.from("candidates").insert(payload).select("id");
    if (err) {
      setError(err.message);
    } else {
      setResult({ count: data.length });
    }
    setImport(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Import Candidates from CSV</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Columns: First Name, Last Name, Email, Phone, City, State, Work Auth, Title, Company, Experience, Skills, Summary
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* File picker */}
          {!result && (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-2xl p-8 cursor-pointer hover:bg-indigo-50/50 transition-colors">
              <FileUp className="w-8 h-8 text-indigo-400 mb-2" />
              <p className="text-sm font-semibold text-indigo-600">{fileName || "Click to choose a CSV file"}</p>
              <p className="text-xs text-gray-400 mt-1">or drag and drop</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
            </label>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Success */}
          {result && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
              <p className="text-lg font-bold text-gray-900">{result.count} candidates imported</p>
              <p className="text-sm text-gray-400 mt-1">They are now in your candidate pool</p>
              <button onClick={onImported}
                className="mt-5 px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700">
                Done
              </button>
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && !result && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Preview — {rows.length} row{rows.length !== 1 ? "s" : ""} detected
              </p>
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {["First","Last","Email","Title","Company","Auth","Exp","Skills"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-gray-700">{r.first_name}</td>
                        <td className="px-3 py-2 text-gray-700">{r.last_name}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate">{r.email}</td>
                        <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{r.current_title}</td>
                        <td className="px-3 py-2 text-gray-600 max-w-[120px] truncate">{r.current_company}</td>
                        <td className="px-3 py-2 text-gray-500">{r.work_authorization}</td>
                        <td className="px-3 py-2 text-gray-500">{r.experience_years}</td>
                        <td className="px-3 py-2 text-gray-500 max-w-[160px] truncate">{r.skills}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 10 && (
                  <p className="text-center py-2 text-xs text-gray-400">… and {rows.length - 10} more rows</p>
                )}
              </div>
            </div>
          )}
        </div>

        {rows.length > 0 && !result && (
          <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleImport} disabled={importing}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {importing ? <><Loader className="w-4 h-4 animate-spin" /> Importing…</> : `Import ${rows.length} Candidates`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add / Edit Candidate Modal ───────────────────────────────
function CandidateModal({ candidate, vendorId, onClose, onSaved }) {
  const { profile } = useAuth();
  const isEdit = Boolean(candidate);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: candidate ? {
      first_name:         candidate.first_name,
      last_name:          candidate.last_name,
      email:              candidate.email ?? "",
      phone:              candidate.phone ?? "",
      city:               candidate.city ?? "",
      state:              candidate.state ?? "",
      work_authorization: candidate.work_authorization ?? "",
      current_title:      candidate.current_title ?? "",
      current_company:    candidate.current_company ?? "",
      experience_years:   candidate.experience_years ?? "",
      skills:             (candidate.skills ?? []).join(", "),
      summary:            candidate.summary ?? "",
    } : {}
  });

  async function onSubmit(data) {
    const payload = {
      ...data,
      skills:           data.skills ? data.skills.split(",").map(s => s.trim()).filter(Boolean) : [],
      experience_years: data.experience_years ? parseInt(data.experience_years) : null,
      vendor_id:        vendorId,
      added_by:         profile.id,
    };
    delete payload.skills_raw;

    let error;
    if (isEdit) {
      ({ error } = await supabase.from("candidates").update(payload).eq("id", candidate.id));
    } else {
      ({ error } = await supabase.from("candidates").insert(payload));
    }
    if (error) { alert(error.message); return; }
    onSaved();
  }

  const field = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-bold text-gray-900 text-lg">{isEdit ? "Edit Candidate" : "Add Candidate"}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">

            {/* Identity */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">Identity</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">First Name *</label>
                  <input {...register("first_name", { required: "Required" })} placeholder="Jane" className={field} />
                  {errors.first_name && <p className="text-red-500 text-xs mt-0.5">{errors.first_name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Last Name *</label>
                  <input {...register("last_name", { required: "Required" })} placeholder="Smith" className={field} />
                  {errors.last_name && <p className="text-red-500 text-xs mt-0.5">{errors.last_name.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input {...register("email")} type="email" placeholder="jane@email.com" className={field} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                  <input {...register("phone")} placeholder="+1 555 000 0000" className={field} />
                </div>
              </div>
            </div>

            {/* Location + Authorization */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">Location & Authorization</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">City</label>
                  <input {...register("city")} placeholder="Austin" className={field} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">State</label>
                  <input {...register("state")} placeholder="TX" className={field} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Work Authorization</label>
                  <select {...register("work_authorization")} className={field + " bg-white"}>
                    <option value="">Select…</option>
                    {WORK_AUTH.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Professional */}
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">Professional</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Current Title</label>
                  <input {...register("current_title")} placeholder="Software Engineer" className={field} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Current Company</label>
                  <input {...register("current_company")} placeholder="Acme Corp" className={field} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Years of Experience</label>
                  <input {...register("experience_years")} type="number" min={0} max={50} placeholder="5" className={field} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Skills (comma-separated)</label>
                  <input {...register("skills")} placeholder="Python, AWS, React" className={field} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Summary</label>
                  <textarea {...register("summary")} rows={3}
                    placeholder="Brief professional summary…"
                    className={field + " resize-none"} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {isSubmitting ? <><Loader className="w-4 h-4 animate-spin" /> Saving…</> : isEdit ? "Save Changes" : "Add Candidate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Candidate Row (expandable) ───────────────────────────────
function CandidateRow({ candidate, vendorId, onEdit, onRefresh }) {
  const { session } = useAuth();
  const [expanded, setExpanded]     = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [parsing, setParsing]       = useState(false);
  const [resumeUrl, setResumeUrl]   = useState(null);

  async function handleResumeUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const path = `${vendorId}/${candidate.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("resumes").upload(path, file, { upsert: true });
    if (!error) {
      await supabase.from("candidates").update({
        resume_path:         path,
        resume_filename:     file.name,
        resume_content_type: file.type,
      }).eq("id", candidate.id);
      onRefresh();
    } else {
      alert(error.message);
    }
    setUploading(false);
  }

  async function handleViewResume() {
    const { data } = await supabase.storage.from("resumes")
      .createSignedUrl(candidate.resume_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function handleParseResume() {
    setParsing(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000); // 60s for cold start
      const res = await fetch(`${BACKEND_URL}/parse-resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ candidate_id: candidate.id }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Parse failed");
      onRefresh();
    } catch (err) {
      if (err.name === "AbortError") {
        alert("Request timed out. The server may be waking up — please try again in 30 seconds.");
      } else {
        alert(err.message);
      }
    }
    setParsing(false);
  }

  return (
    <>
      <tr className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600
                            flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {candidate.first_name?.[0]}{candidate.last_name?.[0]}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                {candidate.first_name} {candidate.last_name}
              </p>
              {candidate.current_title && (
                <p className="text-xs text-gray-400">{candidate.current_title}</p>
              )}
            </div>
          </div>
        </td>
        <td className="px-5 py-3.5 text-sm text-gray-500">
          {candidate.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{candidate.email}</p>}
          {candidate.phone && <p className="flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{candidate.phone}</p>}
        </td>
        <td className="px-5 py-3.5 text-sm text-gray-500">
          {[candidate.city, candidate.state].filter(Boolean).join(", ") || "—"}
        </td>
        <td className="px-5 py-3.5 text-sm text-gray-500">
          {candidate.work_authorization || "—"}
        </td>
        <td className="px-5 py-3.5 text-center">
          {candidate.resume_path ? (
            <span className="flex items-center justify-center gap-1 text-[10px] text-emerald-600 font-semibold">
              <FileText className="w-3 h-3" /> Resume
            </span>
          ) : (
            <span className="text-[10px] text-gray-300">No resume</span>
          )}
        </td>
        <td className="px-5 py-3.5 text-center">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize
                           ${STATUS_BADGE[candidate.status] ?? "bg-gray-100 text-gray-500"}`}>
            {candidate.status}
          </span>
        </td>
        <td className="px-5 py-3.5 text-right">
          <div className="flex items-center justify-end gap-1">
            <button onClick={e => { e.stopPropagation(); onEdit(candidate); }}
              className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-indigo-50/30">
          <td colSpan={7} className="px-5 py-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              {candidate.current_company && (
                <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Company</p>
                <p className="text-gray-700">{candidate.current_company}</p></div>
              )}
              {candidate.experience_years != null && (
                <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Experience</p>
                <p className="text-gray-700">{candidate.experience_years} years</p></div>
              )}
              {candidate.skills?.length > 0 && (
                <div className="col-span-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.skills.map(s => (
                      <span key={s} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {candidate.summary && (
                <div className="col-span-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Summary</p>
                  <p className="text-gray-600 text-xs leading-relaxed">{candidate.summary}</p>
                </div>
              )}

              {/* AI Parsed Data */}
              {candidate.resume_parsed && (
                <div className="col-span-3 border-t border-indigo-100/60 pt-3 space-y-3">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> AI Parsed Data
                  </p>

                  {/* Work Experience */}
                  {candidate.parsed_experience?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Work Experience</p>
                      <div className="space-y-1.5">
                        {candidate.parsed_experience.map((e, i) => (
                          <div key={i} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <p className="text-xs font-semibold text-gray-800">{e.title}
                              {e.company && <span className="font-normal text-gray-500"> · {e.company}</span>}
                            </p>
                            {(e.start || e.end) && (
                              <p className="text-[11px] text-gray-400">{e.start}{e.end ? ` → ${e.end}` : ""}</p>
                            )}
                            {e.summary && <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{e.summary}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {candidate.parsed_education?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Education</p>
                      <div className="space-y-1">
                        {candidate.parsed_education.map((e, i) => (
                          <div key={i} className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <p className="text-xs font-semibold text-gray-800">{e.degree}</p>
                            <p className="text-[11px] text-gray-500">{e.institution}{e.year ? ` · ${e.year}` : ""}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Certifications */}
                  {candidate.parsed_certifications?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Certifications</p>
                      <div className="flex flex-wrap gap-1.5">
                        {candidate.parsed_certifications.map((c, i) => (
                          <span key={i} className="text-xs bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resume actions */}
              <div className="col-span-3 flex items-center gap-3 pt-2 border-t border-indigo-100/60">
                <label className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                                  border border-gray-200 cursor-pointer hover:bg-white transition-colors
                                  ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
                  {uploading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {candidate.resume_path ? "Replace Resume" : "Upload Resume"}
                  <input type="file" accept=".pdf,.doc,.docx" className="sr-only"
                    onChange={e => { e.stopPropagation(); handleResumeUpload(e); }} />
                </label>

                {candidate.resume_path && (
                  <>
                    <button onClick={e => { e.stopPropagation(); handleViewResume(); }}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                                 border border-gray-200 hover:bg-white transition-colors text-indigo-600">
                      <ExternalLink className="w-3.5 h-3.5" /> View Resume
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleParseResume(); }}
                      disabled={parsing}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
                                 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-60">
                      {parsing
                        ? <><Loader className="w-3.5 h-3.5 animate-spin" /> Parsing…</>
                        : <><Sparkles className="w-3.5 h-3.5" /> AI Parse</>}
                    </button>
                    <span className="text-xs text-gray-400">{candidate.resume_filename}</span>
                  </>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function CandidatesPage() {
  const { profile } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [showModal, setShowModal]     = useState(false);
  const [editing, setEditing]         = useState(null);
  const [showImport, setShowImport]   = useState(false);

  useEffect(() => { if (profile?.vendor_id) load(); }, [profile]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("candidates")
      .select("*")
      .eq("vendor_id", profile.vendor_id)
      .order("created_at", { ascending: false });
    setCandidates(data ?? []);
    setLoading(false);
  }

  const filtered = candidates.filter(c =>
    !search ||
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.current_title?.toLowerCase().includes(search.toLowerCase()) ||
    c.skills?.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Candidates</h1>
          <p className="text-sm text-gray-400 mt-0.5">{candidates.length} in your database</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <FileUp className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Candidate
          </button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, title, skill…"
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
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{search ? "No candidates match" : "No candidates yet"}</p>
            {!search && <p className="text-sm mt-1">Click "Add Candidate" to build your talent pool</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Candidate</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Contact</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Location</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Auth</th>
                <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Resume</th>
                <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(c => (
                <CandidateRow key={c.id} candidate={c}
                  vendorId={profile.vendor_id}
                  onEdit={cand => { setEditing(cand); setShowModal(true); }}
                  onRefresh={load} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <CandidateModal
          candidate={editing}
          vendorId={profile.vendor_id}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => { setShowModal(false); setEditing(null); load(); }}
        />
      )}

      {showImport && (
        <CsvImportModal
          vendorId={profile.vendor_id}
          profileId={profile.id}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); load(); }}
        />
      )}
    </div>
  );
}

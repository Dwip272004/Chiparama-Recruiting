import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../lib/api";
import {
  Plus, Search, X, Loader, Users, Mail, Eye, EyeOff,
  RefreshCw, Copy, CheckCircle2, KeyRound, Trash2
} from "lucide-react";

const STATUS_BADGE = {
  active:    "bg-emerald-100 text-emerald-700",
  inactive:  "bg-gray-100 text-gray-500",
  suspended: "bg-red-100 text-red-600",
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001";

function genPassword() {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;
  let pwd = [
    upper[Math.floor(Math.random() * upper.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
    ...Array.from({ length: 9 }, () => all[Math.floor(Math.random() * all.length)]),
  ];
  return pwd.sort(() => Math.random() - 0.5).join("");
}

// ─── Credentials Modal (shown after successful creation) ─────
function CredentialsModal({ email, password, onClose }) {
  const [copiedField, setCopiedField] = useState(null);

  function copy(text, field) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function copyAll() {
    copy(
      `Portal: ${window.location.origin}/login\nEmail: ${email}\nPassword: ${password}`,
      "all"
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Vendor Created</h2>
            <p className="text-xs text-gray-400 mt-0.5">Share these credentials with the vendor</p>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {/* Portal URL */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Portal URL</p>
              <p className="text-sm text-gray-700 truncate">{window.location.origin}/login</p>
            </div>
            <button onClick={() => copy(`${window.location.origin}/login`, "url")}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
              {copiedField === "url" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>

          {/* Email */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Email</p>
              <p className="text-sm text-gray-700 truncate">{email}</p>
            </div>
            <button onClick={() => copy(email, "email")}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
              {copiedField === "email" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>

          {/* Password */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide mb-0.5">Password</p>
              <p className="text-sm font-mono font-semibold text-indigo-700">{password}</p>
            </div>
            <button onClick={() => copy(password, "pwd")}
              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
              {copiedField === "pwd" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-indigo-400" />}
            </button>
          </div>

          <button onClick={copyAll}
            className="w-full py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600
                       hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
            {copiedField === "all" ? <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy All</>}
          </button>

          <p className="text-[11px] text-gray-400 text-center">
            Save this password now — it won't be shown again.
          </p>
        </div>

        <div className="px-6 pb-5">
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Vendor Modal ─────────────────────────────────────
function InviteModal({ onClose, onCreated }) {
  const { session } = useAuth();
  const [serverError, setServerError] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { password: genPassword() }
  });

  async function onSubmit(data) {
    setServerError("");
    try {
      const res = await apiFetch("/admin/vendors", {
        method: "POST",
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create vendor");
      onCreated(json.vendor, data.email, data.password);
    } catch (err) {
      setServerError(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Add Vendor</h2>
            <p className="text-xs text-gray-400 mt-0.5">Account is created instantly — share credentials manually</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Company Name *</label>
              <input {...register("company_name", { required: "Required" })}
                placeholder="Apex Staffing Inc."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Contact Name *</label>
              <input {...register("primary_contact", { required: "Required" })}
                placeholder="Jane Smith"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              {errors.primary_contact && <p className="text-red-500 text-xs mt-1">{errors.primary_contact.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Phone</label>
              <input {...register("phone")}
                placeholder="+1 555 000 0000"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Login Email *</label>
              <input {...register("email", { required: "Required", pattern: { value: /\S+@\S+\.\S+/, message: "Invalid email" } })}
                type="email" placeholder="jane@apexstaffing.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Password field with generator */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Password *</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    {...register("password", { required: "Required", minLength: { value: 8, message: "Min 8 characters" } })}
                    type={showPwd ? "text" : "password"}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm font-mono
                               focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button type="button"
                  onClick={() => setValue("password", genPassword(), { shouldValidate: true })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200
                             text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0">
                  <RefreshCw className="w-3.5 h-3.5" /> Generate
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes (internal)</label>
              <textarea {...register("notes")} rows={2} placeholder="Optional internal notes…"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
            </div>
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{serverError}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60">
              {isSubmitting
                ? <><Loader className="w-4 h-4 animate-spin" /> Creating…</>
                : <><KeyRound className="w-4 h-4" /> Create Account</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function VendorsPage() {
  const [vendors, setVendors]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const { session }                   = useAuth();
  const [showModal, setShowModal]     = useState(false);
  const [credentials, setCredentials] = useState(null);
  const [deletingId, setDeletingId]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { fetchVendors(); }, []);

  async function fetchVendors() {
    setLoading(true);
    const { data } = await supabase
      .from("vendors")
      .select("*, submissions(id, stage)")
      .order("created_at", { ascending: false });
    setVendors(data ?? []);
    setLoading(false);
  }

  function handleCreated(vendor, email, password) {
    setShowModal(false);
    setCredentials({ email, password });
    fetchVendors();
  }

  async function deleteVendor(id) {
    setDeleteLoading(true);
    await apiFetch(`/admin/vendors/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setDeleteLoading(false);
    fetchVendors();
  }

  async function toggleStatus(vendor) {
    const next = vendor.status === "active" ? "inactive" : "active";
    await supabase.from("vendors").update({ status: next }).eq("id", vendor.id);
    setVendors(v => v.map(x => x.id === vendor.id ? { ...x, status: next } : x));
  }

  const filtered = vendors.filter(v =>
    !search ||
    v.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    v.primary_contact?.toLowerCase().includes(search.toLowerCase()) ||
    v.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-400 mt-0.5">{vendors.length} vendor{vendors.length !== 1 ? "s" : ""} onboarded</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white
                     rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search vendors…"
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">{search ? "No vendors match" : "No vendors yet"}</p>
            {!search && <p className="text-sm mt-1">Click "Invite Vendor" to get started</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Vendor</th>
                <th className="text-left px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Contact</th>
                <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Submissions</th>
                <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Placed</th>
                <th className="text-center px-5 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(vendor => {
                const subs   = vendor.submissions ?? [];
                const placed = subs.filter(s => s.stage === "placed").length;
                return (
                  <tr key={vendor.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">
                            {vendor.company_name?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{vendor.company_name}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" />{vendor.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">
                      <p className="font-medium">{vendor.primary_contact}</p>
                      {vendor.phone && <p className="text-xs text-gray-400">{vendor.phone}</p>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="font-semibold text-gray-700">{subs.length}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="font-semibold text-emerald-600">{placed}</span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold capitalize
                                       ${STATUS_BADGE[vendor.status] ?? "bg-gray-100 text-gray-500"}`}>
                        {vendor.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggleStatus(vendor)}
                          className="text-xs text-gray-400 hover:text-gray-700 font-medium px-3 py-1.5
                                     rounded-lg hover:bg-gray-100 transition-colors">
                          {vendor.status === "active" ? "Deactivate" : "Activate"}
                        </button>
                        {deletingId === vendor.id ? (
                          <div className="flex items-center gap-1 ml-1">
                            <span className="text-xs text-gray-500">Delete?</span>
                            <button onClick={() => deleteVendor(vendor.id)} disabled={deleteLoading}
                              className="text-xs font-semibold text-red-600 hover:text-red-800 px-2 py-1 rounded-lg hover:bg-red-50 disabled:opacity-60">
                              {deleteLoading ? "…" : "Yes"}
                            </button>
                            <button onClick={() => setDeletingId(null)}
                              className="text-xs font-medium text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100">
                              No
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => setDeletingId(vendor.id)}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete vendor">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <InviteModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
      {credentials && (
        <CredentialsModal
          email={credentials.email}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}
    </div>
  );
}

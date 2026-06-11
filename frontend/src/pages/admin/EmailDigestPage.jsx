import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  Mail, RefreshCw, Plus, X, Loader, ChevronDown, ChevronUp,
  Zap, AlertCircle, Clock, CheckCircle2, Inbox, Tag
} from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001";

const PRIORITY_STYLE = {
  high:   "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low:    "bg-green-100 text-green-700",
};

const PRIORITY_ICON = {
  high:   <AlertCircle className="w-3 h-3" />,
  medium: <Clock className="w-3 h-3" />,
  low:    <CheckCircle2 className="w-3 h-3" />,
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Email Card ───────────────────────────────────────────────
function EmailCard({ digest, onMarkRead }) {
  const [expanded, setExpanded] = useState(false);

  function handleExpand() {
    setExpanded(v => !v);
    if (!digest.is_read) onMarkRead(digest.id);
  }

  const actions = Array.isArray(digest.action_items) ? digest.action_items : [];

  return (
    <div className={`rounded-2xl border transition-colors ${
      digest.is_read
        ? "bg-white border-gray-100"
        : "bg-indigo-50/60 border-indigo-200"
    }`}>
      {/* Card header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={handleExpand}
      >
        {/* Unread dot */}
        <div className="mt-1.5 flex-shrink-0">
          {digest.is_read
            ? <div className="w-2 h-2 rounded-full bg-gray-200" />
            : <div className="w-2 h-2 rounded-full bg-indigo-500" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className={`text-sm font-semibold truncate ${digest.is_read ? "text-gray-700" : "text-gray-900"}`}>
              {digest.from_name || digest.from_address}
            </p>
            <span className="text-[11px] text-gray-400 flex-shrink-0">{timeAgo(digest.received_at)}</span>
          </div>
          <p className={`text-xs truncate mb-2 ${digest.is_read ? "text-gray-400" : "text-gray-600 font-medium"}`}>
            {digest.subject || "(no subject)"}
          </p>

          {/* AI Summary */}
          {digest.summary && (
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              {digest.summary}
            </p>
          )}

          {/* Action Items */}
          {actions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
                <Zap className="w-3 h-3" /> Action Items
              </p>
              {actions.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                    PRIORITY_STYLE[item.priority?.toLowerCase()] ?? PRIORITY_STYLE.medium
                  }`}>
                    {PRIORITY_ICON[item.priority?.toLowerCase()] ?? PRIORITY_ICON.medium}
                    {item.priority?.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-700 leading-relaxed">{item.action}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 mt-0.5 text-gray-300 hover:text-gray-500 transition-colors">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Full email body */}
      {expanded && (
        <div className="px-4 pb-4">
          <div className="border-t border-gray-100 pt-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">
              Full Email — {digest.from_address} · {new Date(digest.received_at).toLocaleString()}
            </p>
            <pre className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap font-sans
                            bg-gray-50 rounded-xl p-3 max-h-80 overflow-y-auto border border-gray-100">
              {digest.body_text || "No content"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function EmailDigestPage() {
  const { session } = useAuth();
  const [digests, setDigests]     = useState([]);
  const [senders, setSenders]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState(null);
  const [showSenders, setShowSenders] = useState(false);
  const [newEmail, setNewEmail]   = useState("");
  const [newLabel, setNewLabel]   = useState("");
  const [addingEmail, setAddingEmail] = useState(false);
  const [filter, setFilter]       = useState("all"); // "all" | "unread"

  const headers = { Authorization: `Bearer ${session?.access_token}`, "Content-Type": "application/json" };

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [digestRes, senderRes] = await Promise.all([
      fetch(`${BACKEND_URL}/email-digest`, { headers }),
      fetch(`${BACKEND_URL}/email-digest/senders`, { headers }),
    ]);
    setDigests(digestRes.ok ? await digestRes.json() : []);
    setSenders(senderRes.ok ? await senderRes.json() : []);
    setLoading(false);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch(`${BACKEND_URL}/email-digest/sync`, { method: "POST", headers });
      const json = await res.json();
      setSyncMsg(json.message ?? "Done.");
      await loadDigests();
    } catch (e) {
      setSyncMsg("Sync failed: " + e.message);
    }
    setSyncing(false);
  }

  async function loadDigests() {
    const res = await fetch(`${BACKEND_URL}/email-digest`, { headers });
    if (res.ok) setDigests(await res.json());
  }

  async function markRead(id) {
    setDigests(prev => prev.map(d => d.id === id ? { ...d, is_read: true } : d));
    fetch(`${BACKEND_URL}/email-digest/${id}/read`, { method: "PATCH", headers }).catch(() => {});
  }

  async function addSender(e) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAddingEmail(true);
    const res = await fetch(`${BACKEND_URL}/email-digest/senders`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email: newEmail.trim(), label: newLabel.trim() || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setSenders(prev => [...prev, data]);
      setNewEmail("");
      setNewLabel("");
    }
    setAddingEmail(false);
  }

  async function removeSender(id) {
    await fetch(`${BACKEND_URL}/email-digest/senders/${id}`, { method: "DELETE", headers });
    setSenders(prev => prev.filter(s => s.id !== id));
  }

  const unreadCount = digests.filter(d => !d.is_read).length;
  const filtered = filter === "unread" ? digests.filter(d => !d.is_read) : digests;

  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-indigo-600" /> Email Digest
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {digests.length} emails · {unreadCount} unread
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSenders(v => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              showSenders
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Tag className="w-4 h-4" />
            Watched Senders {senders.length > 0 && `(${senders.length})`}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold
                       hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm"
          >
            {syncing
              ? <><Loader className="w-4 h-4 animate-spin" /> Syncing…</>
              : <><RefreshCw className="w-4 h-4" /> Sync Now</>
            }
          </button>
        </div>
      </div>

      {/* Sync result message */}
      {syncMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {syncMsg}
        </div>
      )}

      {/* Watched Senders Panel */}
      {showSenders && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-500" /> Watched Senders
          </h2>
          <p className="text-xs text-gray-400">
            Only emails FROM these addresses will be fetched and summarized during sync.
          </p>

          {/* Sender list */}
          {senders.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No senders added yet.</p>
          ) : (
            <div className="space-y-2">
              {senders.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2
                                            bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-700 truncate">{s.email}</span>
                    {s.label && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">
                        {s.label}
                      </span>
                    )}
                  </div>
                  <button onClick={() => removeSender(s.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new sender */}
          <form onSubmit={addSender} className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Email Address *</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                placeholder="client@company.com"
                required
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>
            <div className="w-36 space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Label (optional)</label>
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="Acme Corp"
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-xl
                           focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={addingEmail || !newEmail.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl
                         text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {addingEmail ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[["all", "All"], ["unread", `Unread${unreadCount > 0 ? ` (${unreadCount})` : ""}`]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === val ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Email list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {filter === "unread" ? "No unread emails" : "No emails yet"}
          </p>
          {filter === "all" && senders.length === 0 && (
            <p className="text-sm mt-1">Add watched senders above, then click Sync Now</p>
          )}
          {filter === "all" && senders.length > 0 && (
            <p className="text-sm mt-1">Click Sync Now to fetch emails from watched senders</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(d => (
            <EmailCard key={d.id} digest={d} onMarkRead={markRead} />
          ))}
        </div>
      )}
    </div>
  );
}

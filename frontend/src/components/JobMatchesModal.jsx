import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api";
import {
  X, Zap, RefreshCw, Loader, Users, Star,
  CheckCircle2, AlertCircle, Send, ChevronDown, ChevronUp
} from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001";

function scoreColor(n) {
  if (n >= 80) return "bg-emerald-100 text-emerald-700";
  if (n >= 60) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-600";
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const mins = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function MatchCard({ match, onNotify, notifying }) {
  const [expanded, setExpanded] = useState(false);
  const c = match.candidates ?? {};
  const strengths = Array.isArray(match.strengths) ? match.strengths : [];
  const gaps      = Array.isArray(match.gaps)      ? match.gaps      : [];

  return (
    <div className="border border-gray-100 rounded-2xl bg-white overflow-hidden hover:border-indigo-200 transition-colors">
      <div className="flex items-start gap-3 p-4">
        {/* Score */}
        <div className={`text-lg font-bold px-3 py-1.5 rounded-xl flex-shrink-0 ${scoreColor(match.score)}`}>
          {match.score}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-gray-900 text-sm">
                {c.first_name} {c.last_name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {c.current_title || "—"}
                {c.experience_years != null && ` · ${c.experience_years}y exp`}
              </p>
            </div>
            <span className="text-[10px] bg-indigo-50 text-indigo-600 font-semibold
                             px-2 py-0.5 rounded-full flex-shrink-0">
              {match.vendors?.company_name}
            </span>
          </div>

          {/* Recommendation */}
          {match.recommendation && (
            <p className="text-xs text-gray-500 mt-2 leading-relaxed italic">
              "{match.recommendation}"
            </p>
          )}

          {/* Strengths chips */}
          {strengths.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {strengths.map((s, i) => (
                <span key={i} className="text-[10px] bg-emerald-50 text-emerald-700
                                         px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> {s}
                </span>
              ))}
            </div>
          )}

          {/* Gaps (expandable) */}
          {gaps.length > 0 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="mt-2 text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {gaps.length} gap{gaps.length !== 1 ? "s" : ""}
            </button>
          )}
          {expanded && gaps.length > 0 && (
            <div className="mt-1 space-y-1">
              {gaps.map((g, i) => (
                <p key={i} className="text-[10px] text-red-500 flex items-start gap-1">
                  <AlertCircle className="w-2.5 h-2.5 flex-shrink-0 mt-0.5" /> {g}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Notify button */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          {match.notified_at ? (
            <span className="text-[10px] text-gray-400 text-right">
              Notified<br />{timeAgo(match.notified_at)}
            </span>
          ) : (
            <button
              onClick={() => onNotify(match.id)}
              disabled={notifying === match.id}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl
                         bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {notifying === match.id
                ? <Loader className="w-3 h-3 animate-spin" />
                : <Send className="w-3 h-3" />}
              Notify
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function JobMatchesModal({ job, onClose }) {
  const [matches,   setMatches]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [scanning,  setScanning]  = useState(false);
  const [notifying, setNotifying] = useState(null);
  const [pollCount, setPollCount] = useState(0);

  const fetchMatches = useCallback(async () => {
    const res = await apiFetch(`/reverse-match/${job.id}`);
    if (res.ok) {
      const data = await res.json();
      setMatches(data);
      return data.length;
    }
    return 0;
  }, [job.id]);

  // On open: load existing matches, then poll if empty (scan may be running)
  useEffect(() => {
    let cancelled = false;
    let timer;

    async function init() {
      setLoading(true);
      const count = await fetchMatches();
      setLoading(false);

      // If no results yet, poll every 4s (scan is probably still running)
      if (count === 0 && !cancelled) {
        const poll = async () => {
          if (cancelled) return;
          setPollCount(n => n + 1);
          const n = await fetchMatches();
          if (n === 0 && !cancelled) timer = setTimeout(poll, 4000);
        };
        timer = setTimeout(poll, 4000);
      }
    }

    init();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [fetchMatches]);

  async function handleScan() {
    setScanning(true);
    setMatches([]);
    await apiFetch(`/reverse-match/${job.id}/scan`, { method: "POST" });
    // Poll for results
    const poll = async (attempt = 0) => {
      const count = await fetchMatches();
      if (count === 0 && attempt < 15) setTimeout(() => poll(attempt + 1), 4000);
      else setScanning(false);
    };
    setTimeout(() => poll(), 4000);
  }

  async function handleNotify(matchId) {
    setNotifying(matchId);
    const res = await apiFetch(`/reverse-match/${matchId}/notify`, { method: "POST" });
    if (res.ok) {
      setMatches(prev =>
        prev.map(m => m.id === matchId ? { ...m, notified_at: new Date().toISOString() } : m)
      );
    }
    setNotifying(null);
  }

  const isScanning = scanning || (loading === false && matches.length === 0 && pollCount > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-50 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 bg-white border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <h2 className="font-bold text-gray-900 text-lg">AI Suggested Candidates</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1 ml-9">{job.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl
                         border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
              Re-scan
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Info bar */}
        <div className="px-6 py-2.5 bg-indigo-50 border-b border-indigo-100 flex-shrink-0">
          <p className="text-xs text-indigo-700">
            <strong>How it works:</strong> Candidates are pre-ranked by skill overlap (free), then the top 25 are AI-scored.
            Scores are cached — re-scanning only costs AI credits for <em>new</em> candidates.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading matches…</p>
            </div>
          ) : isScanning ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-gray-700">Scanning candidate pool…</p>
              <p className="text-xs text-gray-400 text-center max-w-xs">
                Pre-filtering by skill overlap, then scoring top candidates with AI.
                This takes 30–60 seconds.
              </p>
            </div>
          ) : matches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
              <Users className="w-10 h-10 opacity-30" />
              <p className="font-medium text-sm">No matches yet</p>
              <p className="text-xs text-center max-w-xs">
                Click Re-scan to scan the candidate pool. Results will appear here and are cached for free on future opens.
              </p>
              <button
                onClick={handleScan}
                className="flex items-center gap-2 mt-2 px-4 py-2 bg-indigo-600 text-white
                           rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
              >
                <Zap className="w-4 h-4" /> Scan Now
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-400">
                  {matches.length} candidates scored · sorted by AI fit score
                </p>
                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> ≥80</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> ≥60</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt;60</span>
                </div>
              </div>
              {matches.map(m => (
                <MatchCard key={m.id} match={m} onNotify={handleNotify} notifying={notifying} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

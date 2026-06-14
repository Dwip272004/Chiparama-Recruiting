import express from "express";
import { createClient } from "@supabase/supabase-js";
import { scanCandidatesForJob } from "./reverseMatchService.js";
import { sendCandidateRequestEmail } from "./emailService.js";

const router = express.Router();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  req.user = user;
  next();
}

// ── GET /reverse-match/:jobId ─────────────────────────────────
// Returns top cached matches for a job (no AI call — reads from DB)
router.get("/reverse-match/:jobId", requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("job_candidate_matches")
    .select(`
      id, score, strengths, gaps, recommendation, scored_at, notified_at,
      candidates(id, first_name, last_name, current_title, experience_years, work_authorization),
      vendors(id, company_name)
    `)
    .eq("job_id", req.params.jobId)
    .order("score", { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// ── POST /reverse-match/:jobId/scan ──────────────────────────
// Trigger (or re-trigger) background scan for a job
router.post("/reverse-match/:jobId/scan", requireAdmin, async (req, res) => {
  // Respond immediately — scan runs in background
  res.json({ ok: true, message: "Scan started. Results will appear shortly." });

  scanCandidatesForJob(req.params.jobId).catch(err =>
    console.warn("[reverse-match] Scan error:", err.message)
  );
});

// ── POST /reverse-match/:matchId/notify ──────────────────────
// Email the vendor asking them to submit a specific candidate
router.post("/reverse-match/:matchId/notify", requireAdmin, async (req, res) => {
  const { data: match, error } = await supabaseAdmin
    .from("job_candidate_matches")
    .select(`
      id, score,
      candidates(first_name, last_name),
      jobs(id, title),
      vendors(id, company_name)
    `)
    .eq("id", req.params.matchId)
    .single();

  if (error || !match) return res.status(404).json({ error: "Match not found" });

  // Fetch vendor user emails
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("vendor_id", match.vendors?.id);

  const emails = (profiles ?? []).map(p => p.email).filter(Boolean);

  for (const email of emails) {
    sendCandidateRequestEmail({
      to:            email,
      vendorName:    match.vendors?.company_name ?? "Vendor",
      candidateName: `${match.candidates?.first_name} ${match.candidates?.last_name}`,
      jobTitle:      match.jobs?.title ?? "the role",
      score:         match.score,
    }).catch(() => {});
  }

  await supabaseAdmin
    .from("job_candidate_matches")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", req.params.matchId);

  console.log(`[reverse-match] Notified ${emails.length} contacts at ${match.vendors?.company_name}`);
  res.json({ ok: true, notified: emails.length });
});

export default router;

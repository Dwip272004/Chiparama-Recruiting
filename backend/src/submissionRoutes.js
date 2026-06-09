import express from "express";
import { createClient } from "@supabase/supabase-js";
import { sendStageChangedEmail } from "./emailService.js";

const router = express.Router();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token provided" });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });
  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  req.adminUser = user;
  next();
}

// POST /submissions/update-stage
// Updates stage + feedback fields, then fires email if stage changed
router.post("/submissions/update-stage", requireAdmin, async (req, res) => {
  const { submission_id, stage, admin_feedback, admin_feedback_visible, rejection_reason, internal_notes } = req.body;
  if (!submission_id || !stage) return res.status(400).json({ error: "submission_id and stage required" });

  // Fetch current record for email context
  const { data: sub, error: fetchErr } = await supabaseAdmin
    .from("submissions")
    .select("stage, vendor_id, candidates(first_name, last_name), jobs(title)")
    .eq("id", submission_id)
    .single();
  if (fetchErr || !sub) return res.status(404).json({ error: "Submission not found" });

  const fromStage = sub.stage;

  // Apply update
  const { error } = await supabaseAdmin.from("submissions").update({
    stage,
    admin_feedback:         admin_feedback || null,
    admin_feedback_visible: admin_feedback_visible ?? false,
    rejection_reason:       rejection_reason || null,
    internal_notes:         internal_notes || null,
  }).eq("id", submission_id);
  if (error) return res.status(500).json({ error: error.message });

  // Send email if stage changed
  if (stage !== fromStage && sub.vendor_id) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("vendor_id", sub.vendor_id)
      .limit(1);
    const vendorEmail = profiles?.[0]?.email;

    if (vendorEmail) {
      const candidateName = [sub.candidates?.first_name, sub.candidates?.last_name].filter(Boolean).join(" ");
      sendStageChangedEmail({
        to:            vendorEmail,
        candidateName,
        jobTitle:      sub.jobs?.title ?? "—",
        fromStage,
        toStage:       stage,
        feedback:      admin_feedback_visible ? (admin_feedback || null) : null,
      }).catch(err => console.error("[email] Stage change send failed:", err.message));
    }
  }

  res.json({ ok: true });
});

export default router;

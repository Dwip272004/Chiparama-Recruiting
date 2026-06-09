// ============================================================
// Admin API routes — requires a valid admin JWT in Authorization header
// ============================================================

import express from "express";
import { createClient } from "@supabase/supabase-js";
import { sendVendorWelcomeEmail, sendJobAssignedEmail } from "./emailService.js";

const router = express.Router();

// Service-role client for admin operations (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ──────────────────────────────────────────────
// Middleware: verify JWT and require admin role
// ──────────────────────────────────────────────
async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token provided" });

  // Verify the JWT belongs to a real Supabase user
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid or expired token" });

  // Check their profile role
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return res.status(403).json({ error: "Admin access required" });

  req.adminUser = user;
  next();
}

// ──────────────────────────────────────────────
// POST /admin/vendors
// Create a vendor record + invite the contact via email
// ──────────────────────────────────────────────
router.post("/vendors", requireAdmin, async (req, res) => {
  const { company_name, primary_contact, email, phone, notes, password } = req.body;

  if (!company_name || !primary_contact || !email || !password) {
    return res.status(400).json({ error: "company_name, primary_contact, email, and password are required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  // 1. Create the vendor record first so we have an ID
  const { data: vendor, error: vendorErr } = await supabaseAdmin
    .from("vendors")
    .insert({
      company_name,
      primary_contact,
      email,
      phone: phone || null,
      notes: notes || null,
      onboarded_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (vendorErr) return res.status(400).json({ error: vendorErr.message });

  // 2. Create the auth user with the provided password (no email required)
  //    email_confirm: true = skip verification, vendor can log in immediately
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role:      "vendor",
      vendor_id: vendor.id,
      full_name: primary_contact,
    },
  });

  if (authErr) {
    await supabaseAdmin.from("vendors").delete().eq("id", vendor.id);
    return res.status(400).json({ error: authErr.message });
  }

  // Send welcome email (non-blocking — don't fail the request if SMTP is down)
  sendVendorWelcomeEmail({ to: email, vendorName: company_name, password })
    .catch(err => console.warn("[email] Welcome email failed:", err.message));

  console.log(`[admin] Vendor created: ${company_name} (${email})`);
  res.status(201).json({ vendor, user: { id: authData.user.id, email: authData.user.email } });
});

// ──────────────────────────────────────────────
// POST /admin/assign-job
// Assign (or update) multiple vendors to a job
// Idempotent: existing assignments are updated, new ones are inserted
// ──────────────────────────────────────────────
router.post("/assign-job", requireAdmin, async (req, res) => {
  const { job_id, vendor_ids, deadline, max_submissions, priority, instructions } = req.body;

  if (!job_id || !Array.isArray(vendor_ids)) {
    return res.status(400).json({ error: "job_id and vendor_ids[] are required" });
  }

  // Upsert assignments for selected vendors
  const upserts = vendor_ids.map(vendor_id => ({
    job_id,
    vendor_id,
    assigned_by:     req.adminUser.id,
    assigned_at:     new Date().toISOString(),
    deadline:        deadline || null,
    max_submissions: max_submissions ?? 10,
    priority:        priority ?? "normal",
    instructions:    instructions || null,
    status:          "active",
  }));

  const { error: upsertErr } = await supabaseAdmin
    .from("job_vendor_assignments")
    .upsert(upserts, { onConflict: "job_id,vendor_id" });

  if (upsertErr) return res.status(400).json({ error: upsertErr.message });

  // Deactivate any assignments for vendors NOT in the new list
  if (vendor_ids.length > 0) {
    await supabaseAdmin
      .from("job_vendor_assignments")
      .update({ status: "closed" })
      .eq("job_id", job_id)
      .not("vendor_id", "in", `(${vendor_ids.map(id => `"${id}"`).join(",")})`);
  } else {
    // Empty selection = close all assignments for this job
    await supabaseAdmin
      .from("job_vendor_assignments")
      .update({ status: "closed" })
      .eq("job_id", job_id);
  }

  // Fire job-assigned emails to all selected vendors (non-blocking)
  if (vendor_ids.length > 0) {
    const { data: jobRow } = await supabaseAdmin
      .from("jobs")
      .select("title, location")
      .eq("id", job_id)
      .single();

    for (const vid of vendor_ids) {
      const { data: vProfiles } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("vendor_id", vid)
        .limit(1);
      const vendorEmail = vProfiles?.[0]?.email;
      if (vendorEmail && jobRow) {
        sendJobAssignedEmail({
          to:             vendorEmail,
          jobTitle:       jobRow.title,
          jobLocation:    jobRow.location ?? null,
          deadline:       deadline || null,
          maxSubmissions: max_submissions ?? 10,
          priority:       priority ?? "normal",
          instructions:   instructions || null,
        }).catch(err => console.warn("[email] Job-assigned email failed:", err.message));
      }
    }
  }

  console.log(`[admin] Job ${job_id} assigned to ${vendor_ids.length} vendor(s)`);
  res.json({ success: true, assigned: vendor_ids.length });
});

// ──────────────────────────────────────────────
// POST /admin/jobs  — create a job manually
// ──────────────────────────────────────────────
router.post("/jobs", requireAdmin, async (req, res) => {
  const { title, description, location_city, location_state, work_type,
          employment_type, start_date, num_positions, top_skills } = req.body;
  if (!title) return res.status(400).json({ error: "title is required" });

  const { data, error } = await supabaseAdmin.from("jobs").insert({
    title,
    description:     description     || null,
    location_city:   location_city   || null,
    location_state:  location_state  || null,
    work_type:       work_type       || "onsite",
    employment_type: employment_type || "contract",
    start_date:      start_date      || null,
    num_positions:   parseInt(num_positions) || 1,
    top_skills:      Array.isArray(top_skills) ? top_skills : [],
    status:          "active",
    parsed_at:       new Date().toISOString(),
  }).select().single();

  if (error) return res.status(400).json({ error: error.message });
  console.log(`[admin] Job created manually: ${title}`);
  res.status(201).json({ job: data });
});

// ──────────────────────────────────────────────
// DELETE /admin/jobs/:id  — close (soft-delete) a job
// ──────────────────────────────────────────────
router.delete("/jobs/:id", requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin
    .from("jobs").update({ status: "closed" }).eq("id", req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// ──────────────────────────────────────────────
// DELETE /admin/vendors/:id  — delete vendor + auth user
// ──────────────────────────────────────────────
router.delete("/vendors/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  // Find the Supabase Auth user(s) linked to this vendor
  const { data: profiles } = await supabaseAdmin
    .from("profiles").select("id").eq("vendor_id", id);

  for (const p of (profiles ?? [])) {
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(p.id);
    if (delErr) console.warn(`[admin] Auth user delete failed: ${delErr.message}`);
  }

  const { error } = await supabaseAdmin.from("vendors").delete().eq("id", id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// ──────────────────────────────────────────────
// DELETE /admin/submissions/:id  — permanently remove a submission
// ──────────────────────────────────────────────
router.delete("/submissions/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  // Remove interviews first (FK constraint)
  await supabaseAdmin.from("interviews").delete().eq("submission_id", id);
  const { error } = await supabaseAdmin.from("submissions").delete().eq("id", id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

// ──────────────────────────────────────────────
// GET /admin/vendors  (convenience endpoint for SSR or external tools)
// ──────────────────────────────────────────────
router.get("/vendors", requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("vendors")
    .select("*, submissions(id, stage)")
    .order("created_at", { ascending: false });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

export default router;

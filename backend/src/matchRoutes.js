import express from "express";
import { createClient } from "@supabase/supabase-js";
import { Mistral } from "@mistralai/mistralai";

const router = express.Router();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });
  req.user = user;
  next();
}

const MATCH_SCHEMA = {
  type: "object",
  properties: {
    score:          { type: "integer", minimum: 0, maximum: 100 },
    strengths:      { type: "array", items: { type: "string" } },
    gaps:           { type: "array", items: { type: "string" } },
    recommendation: { type: "string" },
  },
  required: ["score", "strengths", "gaps", "recommendation"],
};

// POST /match-score
// Scores a candidate submission against the job using Mistral
router.post("/match-score", requireAuth, async (req, res) => {
  const { submission_id } = req.body;
  if (!submission_id) return res.status(400).json({ error: "submission_id required" });

  const { data: sub, error } = await supabaseAdmin
    .from("submissions")
    .select(`
      id,
      candidates(first_name, last_name, skills, parsed_skills, experience_years,
                 current_title, work_authorization, parsed_experience, parsed_certifications),
      jobs(title, description, requirements, skills_required, experience_min_years)
    `)
    .eq("id", submission_id)
    .single();

  if (error || !sub) return res.status(404).json({ error: "Submission not found" });

  const { candidates: c, jobs: j } = sub;

  const combinedSkills = [...new Set([...(c?.skills ?? []), ...(c?.parsed_skills ?? [])])];

  const prompt = `You are an expert recruiter. Score how well this candidate matches the job opening.

JOB:
- Title: ${j?.title ?? "N/A"}
- Description: ${(j?.description ?? "").slice(0, 1500)}
- Requirements: ${(j?.requirements ?? "").slice(0, 800)}
- Skills needed: ${(j?.skills_required ?? []).join(", ") || "Not specified"}
- Min experience: ${j?.experience_min_years ?? "Not specified"} years

CANDIDATE:
- Name: ${c?.first_name ?? ""} ${c?.last_name ?? ""}
- Title: ${c?.current_title ?? "N/A"}
- Experience: ${c?.experience_years ?? "N/A"} years
- Work auth: ${c?.work_authorization ?? "N/A"}
- Skills: ${combinedSkills.slice(0, 40).join(", ") || "None listed"}
- Past roles: ${(c?.parsed_experience ?? []).slice(0, 3).map(e => `${e.title} at ${e.company}`).join("; ") || "N/A"}
- Certifications: ${(c?.parsed_certifications ?? []).join(", ") || "None"}

Provide:
- score: 0-100 match score
- strengths: 2-3 specific matching points (be concrete)
- gaps: 0-3 specific missing requirements (be concrete, empty array if strong match)
- recommendation: one concise sentence summary`;

  try {
    const resp = await mistral.chat.complete({
      model:       "mistral-small-latest",
      temperature: 0.1,
      messages:    [{ role: "user", content: prompt }],
      responseFormat: {
        type: "json_schema",
        jsonSchema: { name: "match_score", schemaDefinition: MATCH_SCHEMA },
      },
    });

    const result = JSON.parse(resp.choices[0].message.content);

    // Persist score back to submission
    await supabaseAdmin.from("submissions").update({
      match_score:     result.score,
      match_reasoning: result.recommendation,
    }).eq("id", submission_id);

    console.log(`[match] Submission ${submission_id}: score=${result.score}`);
    res.json(result);
  } catch (err) {
    console.error("[match-score]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;

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
router.post("/match-score", requireAuth, async (req, res) => {
  const { submission_id } = req.body;
  if (!submission_id) return res.status(400).json({ error: "submission_id required" });

  const { data: sub, error } = await supabaseAdmin
    .from("submissions")
    .select(`
      id,
      candidates(first_name, last_name, skills, parsed_skills, experience_years,
                 current_title, work_authorization, parsed_experience, parsed_certifications),
      jobs(title, description, top_skills, qualifications, special_requirements,
           experience_years_min, employment_type, work_type)
    `)
    .eq("id", submission_id)
    .single();

  if (error || !sub) return res.status(404).json({ error: "Submission not found" });

  const { candidates: c, jobs: j } = sub;

  const combinedSkills = [...new Set([...(c?.skills ?? []), ...(c?.parsed_skills ?? [])])];
  const jobSkills      = j?.top_skills ?? [];
  const qualifications = (j?.qualifications ?? []).join("; ") || (j?.description ?? "").slice(0, 600);

  const prompt = `You are an expert technical recruiter. Score how well this candidate matches the job.

JOB:
- Title: ${j?.title ?? "N/A"}
- Type: ${j?.employment_type ?? ""} ${j?.work_type ?? ""}
- Description: ${(j?.description ?? "").slice(0, 1200)}
- Required skills: ${jobSkills.join(", ") || "Not specified"}
- Qualifications: ${qualifications}
- Min experience: ${j?.experience_years_min ?? "Not specified"} years

CANDIDATE:
- Title: ${c?.current_title ?? "N/A"}
- Experience: ${c?.experience_years ?? "N/A"} years
- Work authorization: ${c?.work_authorization ?? "N/A"}
- Skills: ${combinedSkills.slice(0, 40).join(", ") || "None listed"}
- Past roles: ${(c?.parsed_experience ?? []).slice(0, 3).map(e => `${e.title} at ${e.company}`).join("; ") || "N/A"}
- Certifications: ${(c?.parsed_certifications ?? []).join(", ") || "None"}

Return:
- score: 0–100 integer (100 = perfect fit)
- strengths: 2–3 concrete matching points
- gaps: 0–3 concrete missing requirements (empty array if strong match)
- recommendation: one sentence summary`;

  let result;
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
    result = JSON.parse(resp.choices[0].message.content);
  } catch (err) {
    console.error("[match-score] Mistral error:", err.message);
    return res.status(500).json({ error: `AI scoring failed: ${err.message}` });
  }

  // Persist score — non-blocking so missing columns don't kill the response
  supabaseAdmin.from("submissions").update({
    match_score:     result.score,
    match_reasoning: result.recommendation,
  }).eq("id", submission_id)
    .then(({ error: dbErr }) => {
      if (dbErr) console.warn("[match-score] DB save failed:", dbErr.message,
        "— run phase4_schema.sql in Supabase if columns are missing");
    });

  console.log(`[match] Submission ${submission_id}: score=${result.score}`);
  res.json(result);
});

export default router;

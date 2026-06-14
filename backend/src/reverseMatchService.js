import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Mistral } from "@mistralai/mistralai";

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    score:          { type: "integer", minimum: 0, maximum: 100 },
    strengths:      { type: "array", items: { type: "string" } },
    gaps:           { type: "array", items: { type: "string" } },
    recommendation: { type: "string" },
  },
  required: ["score", "strengths", "gaps", "recommendation"],
};

// ── Cheap pre-filter: skill overlap ratio (no AI) ────────────
function skillOverlapRatio(candidate, jobSkills) {
  if (!jobSkills?.length) return 0.3; // neutral if job has no skills defined
  const cSkills = new Set(
    [...(candidate.skills ?? []), ...(candidate.parsed_skills ?? [])]
      .map(s => s.toLowerCase().trim())
  );
  const hits = jobSkills.filter(s => cSkills.has(s.toLowerCase().trim()));
  return hits.length / jobSkills.length;
}

// ── Single AI score call ──────────────────────────────────────
async function scoreOne(candidate, job) {
  const cSkills = [
    ...new Set([...(candidate.skills ?? []), ...(candidate.parsed_skills ?? [])]),
  ];
  const jobSkills     = job.top_skills ?? [];
  const qualifications =
    (job.qualifications ?? []).join("; ") ||
    (job.description ?? "").slice(0, 600);

  const resp = await mistral.chat.complete({
    model:       "mistral-small-latest",
    temperature: 0.1,
    messages: [{
      role:    "user",
      content: `You are a technical recruiter. Score how well this candidate fits this job.

JOB:
- Title: ${job.title}
- Type: ${job.employment_type ?? ""} ${job.work_type ?? ""}
- Description: ${(job.description ?? "").slice(0, 800)}
- Required skills: ${jobSkills.join(", ") || "Not specified"}
- Qualifications: ${qualifications}
- Min experience: ${job.experience_years_min ?? "Not specified"} years

CANDIDATE:
- Title: ${candidate.current_title ?? "N/A"}
- Experience: ${candidate.experience_years ?? "N/A"} years
- Work authorization: ${candidate.work_authorization ?? "N/A"}
- Skills: ${cSkills.slice(0, 40).join(", ") || "None listed"}
- Past roles: ${(candidate.parsed_experience ?? []).slice(0, 3).map(e => `${e.title} at ${e.company}`).join("; ") || "N/A"}
- Certifications: ${(candidate.parsed_certifications ?? []).join(", ") || "None"}

Return score 0–100 (100 = perfect fit), 2–3 concrete strengths, 0–3 gaps, one-sentence recommendation.`,
    }],
    responseFormat: {
      type:       "json_schema",
      jsonSchema: { name: "match_score", schemaDefinition: SCORE_SCHEMA },
    },
  });
  return JSON.parse(resp.choices[0].message.content);
}

// ── Main export: scan all candidates against a job ───────────
export async function scanCandidatesForJob(jobId) {
  console.log(`[reverse-match] Scan started for job ${jobId}`);

  // 1. Fetch job details
  const { data: job, error: jobErr } = await supabaseAdmin
    .from("jobs")
    .select("id, title, description, top_skills, qualifications, special_requirements, experience_years_min, employment_type, work_type")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    console.warn("[reverse-match] Job not found:", jobId);
    return { scored: 0, skipped: 0 };
  }

  // 2. Fetch all active candidates that have at least some data
  const { data: candidates } = await supabaseAdmin
    .from("candidates")
    .select("id, vendor_id, first_name, last_name, current_title, experience_years, work_authorization, skills, parsed_skills, parsed_experience, parsed_certifications")
    .eq("status", "active");

  if (!candidates?.length) {
    console.log("[reverse-match] No active candidates in pool");
    return { scored: 0, skipped: 0 };
  }

  // 3. Find which pairs are already cached — skip those entirely (no AI call)
  const { data: cached } = await supabaseAdmin
    .from("job_candidate_matches")
    .select("candidate_id")
    .eq("job_id", jobId);

  const cachedIds  = new Set((cached ?? []).map(r => r.candidate_id));
  const uncached   = candidates.filter(c => !cachedIds.has(c.id));
  const skipped    = candidates.length - uncached.length;

  if (uncached.length === 0) {
    console.log(`[reverse-match] All ${candidates.length} candidates already cached for job "${job.title}"`);
    return { scored: 0, skipped };
  }

  // 4. Pre-rank by cheap skill overlap — only top 25 go to AI
  //    This is the main credit saver: eliminates most candidates without any API call
  const MAX_AI_CALLS = 25;
  const jobSkills = job.top_skills ?? [];

  const toScore = uncached
    .map(c => ({ c, overlap: skillOverlapRatio(c, jobSkills) }))
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, MAX_AI_CALLS);

  const filteredOut = uncached.length - toScore.length;
  console.log(`[reverse-match] Pre-filter: ${toScore.length} to AI-score, ${filteredOut} filtered (low overlap), ${skipped} already cached`);

  // 5. AI-score each shortlisted candidate and upsert result
  let scored = 0;
  for (const { c } of toScore) {
    try {
      const result = await scoreOne(c, job);
      await supabaseAdmin.from("job_candidate_matches").upsert({
        job_id:         jobId,
        candidate_id:   c.id,
        vendor_id:      c.vendor_id,
        score:          result.score,
        strengths:      result.strengths,
        gaps:           result.gaps,
        recommendation: result.recommendation,
        scored_at:      new Date().toISOString(),
      }, { onConflict: "job_id,candidate_id" });
      scored++;
    } catch (err) {
      console.warn(`[reverse-match] AI failed for candidate ${c.id}:`, err.message);
    }
  }

  console.log(`[reverse-match] Done: ${scored} scored, ${skipped} cached, ${filteredOut} filtered for job "${job.title}"`);
  return { scored, skipped, filteredOut };
}

import express from "express";
import { createClient } from "@supabase/supabase-js";
import { Mistral } from "@mistralai/mistralai";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

// ── Auth middleware (any authenticated user) ──────────────────
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid token" });
  req.user = user;
  next();
}

// ── Resume parse schema ───────────────────────────────────────
const RESUME_SCHEMA = {
  type: "object",
  properties: {
    first_name:         { type: "string" },
    last_name:          { type: "string" },
    email:              { type: "string" },
    phone:              { type: "string" },
    city:               { type: "string" },
    state:              { type: "string" },
    current_title:      { type: "string" },
    current_company:    { type: "string" },
    experience_years:   { type: "number" },
    work_authorization: { type: "string" },
    summary:            { type: "string" },
    skills: {
      type: "array",
      items: { type: "string" },
    },
    parsed_education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          degree:      { type: "string" },
          institution: { type: "string" },
          year:        { type: "string" },
        },
        required: ["degree", "institution", "year"],
        additionalProperties: false,
      },
    },
    parsed_experience: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title:   { type: "string" },
          company: { type: "string" },
          start:   { type: "string" },
          end:     { type: "string" },
          summary: { type: "string" },
        },
        required: ["title", "company", "start", "end", "summary"],
        additionalProperties: false,
      },
    },
    parsed_certifications: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "skills",
    "parsed_experience",
    "parsed_education",
    "parsed_certifications",
  ],
};

const RESUME_SYSTEM_PROMPT = `You are an expert resume parser. Extract ALL structured data from the resume text.

CRITICAL — you MUST populate these arrays (do not leave them empty unless truly absent):
- parsed_experience: every job/role the candidate has held. Include title, company, start date, end date (or "Present"), and a 1-sentence summary of responsibilities.
- parsed_education: every degree, diploma, or academic qualification. Include degree name, institution, and year (graduation or expected).
- parsed_certifications: every professional certification, license, or credential mentioned.
- skills: every technical tool, language, framework, platform, or professional skill.

Other rules:
- experience_years: calculate total professional years from work history dates (e.g. 2018–2024 = 6 years)
- work_authorization: if mentioned return exactly one of: "US Citizen", "Green Card", "H1B", "OPT", "EAD", "Other"
- current_title and current_company: use the most recent/current position
- Return empty string "" for missing string scalars, empty array [] only when genuinely absent
- Do NOT invent information — only extract what is explicitly written in the resume`;

// ── POST /parse-resume ────────────────────────────────────────
// Downloads resume from Supabase Storage, sends text to Mistral, updates candidate
router.post("/parse-resume", requireAuth, async (req, res) => {
  const { candidate_id } = req.body;
  if (!candidate_id) return res.status(400).json({ error: "candidate_id required" });

  // Fetch candidate record
  const { data: candidate, error: cErr } = await supabaseAdmin
    .from("candidates")
    .select("resume_path, resume_content_type, vendor_id")
    .eq("id", candidate_id)
    .single();

  if (cErr || !candidate) return res.status(404).json({ error: "Candidate not found" });
  if (!candidate.resume_path) return res.status(400).json({ error: "No resume uploaded" });

  // Download resume from Storage
  const { data: fileData, error: dlErr } = await supabaseAdmin.storage
    .from("resumes")
    .download(candidate.resume_path);

  if (dlErr) return res.status(400).json({ error: dlErr.message });

  // Extract text — use pdf-parse for PDFs, raw text() for everything else
  let resumeText = "";
  const contentType = candidate.resume_content_type ?? "";
  const isPdf = contentType.includes("pdf") ||
                candidate.resume_path?.toLowerCase().endsWith(".pdf");

  try {
    if (isPdf) {
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const parsed = await pdfParse(buffer);
      resumeText = parsed.text ?? "";
    } else {
      resumeText = await fileData.text();
    }
  } catch (extractErr) {
    return res.status(400).json({ error: `Text extraction failed: ${extractErr.message}` });
  }

  resumeText = resumeText.replace(/\s+/g, " ").trim();
  console.log(`[resume] candidate=${candidate_id} isPdf=${isPdf} textLen=${resumeText.length}`);

  if (!resumeText || resumeText.length < 50) {
    return res.status(400).json({
      error: "Could not extract readable text from this file. Try uploading a text-based PDF or a .docx file."
    });
  }

  // Parse with Mistral
  let parsed;
  try {
    const response = await mistral.chat.complete({
      model: "mistral-small-latest",
      temperature: 0.1,
      messages: [
        { role: "system", content: RESUME_SYSTEM_PROMPT },
        { role: "user",   content: `Parse this resume:\n\n${resumeText.slice(0, 12000)}` },
      ],
      responseFormat: {
        type: "json_schema",
        jsonSchema: {
          name: "resume_parsed",
          schemaDefinition: RESUME_SCHEMA,
        },
      },
    });
    parsed = JSON.parse(response.choices[0].message.content);
    console.log(`[resume] Mistral returned: skills=${parsed.skills?.length ?? 0} experience=${parsed.parsed_experience?.length ?? 0} education=${parsed.parsed_education?.length ?? 0} certs=${parsed.parsed_certifications?.length ?? 0}`);
  } catch (err) {
    return res.status(500).json({ error: `Mistral parse error: ${err.message}` });
  }

  // Build update payload — only overwrite fields that were empty
  const update = {
    resume_parsed:         true,
    parsed_skills:         parsed.skills         ?? [],
    parsed_education:      parsed.parsed_education    ?? [],
    parsed_experience:     parsed.parsed_experience   ?? [],
    parsed_certifications: parsed.parsed_certifications ?? [],
  };

  // Auto-fill blank candidate fields from parsed data
  const fillIfEmpty = (dbField, parsedVal) => {
    if (parsedVal) update[dbField] = parsedVal;
  };
  fillIfEmpty("first_name",         parsed.first_name);
  fillIfEmpty("last_name",          parsed.last_name);
  fillIfEmpty("email",              parsed.email);
  fillIfEmpty("phone",              parsed.phone);
  fillIfEmpty("city",               parsed.city);
  fillIfEmpty("state",              parsed.state);
  fillIfEmpty("current_title",      parsed.current_title);
  fillIfEmpty("current_company",    parsed.current_company);
  fillIfEmpty("work_authorization", parsed.work_authorization);
  fillIfEmpty("summary",            parsed.summary);
  if (parsed.skills?.length > 0) update.skills = parsed.skills;
  if (parsed.experience_years)    update.experience_years = Math.round(parsed.experience_years);

  const { error: updateErr } = await supabaseAdmin
    .from("candidates")
    .update(update)
    .eq("id", candidate_id);

  if (updateErr) return res.status(400).json({ error: updateErr.message });

  console.log(`[resume] Saved candidate ${candidate_id}: ${parsed.skills?.length ?? 0} skills, ${parsed.parsed_experience?.length ?? 0} roles, ${parsed.parsed_education?.length ?? 0} education, ${parsed.parsed_certifications?.length ?? 0} certs`);
  res.json({ success: true, extracted: update });
});

export default router;

// ============================================================
// Core parsing logic: email → Mistral → Supabase
// ============================================================

import "dotenv/config";
import { Mistral } from "@mistralai/mistralai";
import { createClient } from "@supabase/supabase-js";
import { JD_SYSTEM_PROMPT, JD_JSON_SCHEMA } from "./mistralConfig.js";

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // service-role key bypasses RLS for inserts
);

// ──────────────────────────────────────────────
// Step 1: Call Mistral with structured output
// ──────────────────────────────────────────────
async function callMistral(rawEmailBody) {
  const response = await mistral.chat.complete({
    model: "mistral-large-latest",
    temperature: 0.1,   // near-zero for deterministic extraction
    messages: [
      { role: "system", content: JD_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Parse the following job description email into the required JSON format:\n\n${rawEmailBody}`
      }
    ],
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "job_posting",
        schemaDefinition: JD_JSON_SCHEMA   // Mistral SDK v1 uses schemaDefinition, not schema
      }
    }
  });

  const raw = response.choices[0].message.content;

  try {
    return JSON.parse(raw);
  } catch {
    // Fallback: strip any accidental markdown fences Mistral might have added
    const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    return JSON.parse(stripped);
  }
}

// ──────────────────────────────────────────────
// Step 2: Flatten parsed JSON → DB row shape
// ──────────────────────────────────────────────
function toDbRecord(parsed, rawEmailBody) {
  return {
    job_reference_id:    parsed.job_reference_id    ?? null,
    title:               parsed.title,
    client_company:      parsed.client_company       ?? null,
    num_positions:       parsed.num_positions        ?? 1,
    employment_type:     parsed.employment_type      ?? "unknown",

    // Flatten nested location object
    location_full_address: parsed.location?.full_address ?? null,
    location_street:       parsed.location?.street       ?? null,
    location_city:         parsed.location?.city         ?? null,
    location_state:        parsed.location?.state        ?? null,
    location_country:      parsed.location?.country      ?? "United States",
    location_zip:          parsed.location?.zip          ?? null,

    work_type:           parsed.work_type            ?? "onsite",
    start_date:          parsed.start_date           ?? null,
    end_date:            parsed.end_date             ?? null,
    schedule:            parsed.schedule             ?? null,
    description:         parsed.description          ?? null,

    top_skills:          parsed.top_skills           ?? [],
    responsibilities:    parsed.responsibilities     ?? [],
    qualifications:      parsed.qualifications       ?? [],
    special_requirements:parsed.special_requirements ?? [],
    tags:                parsed.tags                 ?? [],

    experience_years_min: parsed.experience_years_min ?? null,
    experience_years_max: parsed.experience_years_max ?? null,
    industry:             parsed.industry             ?? null,
    source_system:        parsed.source_system        ?? null,

    raw_email_body: rawEmailBody,
    parsed_at:      new Date().toISOString(),
    status:         "active"
  };
}

// ──────────────────────────────────────────────
// Step 3: Insert into Supabase
// ──────────────────────────────────────────────
async function insertJob(record) {
  const { data, error } = await supabase
    .from("jobs")
    .insert(record)
    .select()
    .single();

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`);
  }
  return data;
}

// ──────────────────────────────────────────────
// Public entry point
// ──────────────────────────────────────────────
export async function parseAndSaveJob(rawEmailBody) {
  console.log("[parseJob] Calling Mistral...");
  const parsed = await callMistral(rawEmailBody);
  console.log(`[parseJob] Parsed: ${parsed.title} @ ${parsed.location?.city}`);

  const record = toDbRecord(parsed, rawEmailBody);

  console.log("[parseJob] Inserting into Supabase...");
  const saved = await insertJob(record);
  console.log(`[parseJob] Saved job ID: ${saved.id}`);

  return saved;
}

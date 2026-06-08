// ============================================================
// Mistral AI configuration: system prompt + JSON schema
// ============================================================

export const JD_SYSTEM_PROMPT = `
You are a specialized Job Description parser for a recruiting automation platform.

Your ONLY task is to extract structured data from raw job description email text and output a
single, valid JSON object that strictly conforms to the schema below. Do NOT include any
preamble, explanation, markdown fences, or commentary — output only the JSON object.

EXTRACTION RULES
─────────────────
1.  job_reference_id   — The numeric or alphanumeric job ID from the subject or body
                         (e.g. "Job Distributed … 3538: …" → "3538"). null if absent.
2.  title              — Verbatim from "Job Title" field.
3.  client_company     — The actual end-client employer name found in the job body,
                         NOT the staffing/vendor agency sending the email. null if absent.
4.  num_positions      — From "Number of Positions". Default 1 if not specified.
5.  employment_type    — If the posting has explicit start/end dates and no other indicator,
                         classify as "contract". Use enum values exactly.
6.  location           — Parse "Job Location" into components. ZIP is the last numeric part.
7.  work_type          — Look for explicit markers: "100% ONSITE", "remote", "hybrid".
                         If an on-site address is given with no remote mention → "onsite".
8.  start_date / end_date — Convert to YYYY-MM-DD (e.g. "6/1/26" → "2026-06-01"). null if absent.
9.  schedule           — Capture hours and any non-billable notes as a single string.
10. description        — The narrative job description paragraphs only (no bullet sections).
11. top_skills         — From the "Top Skills" section if present; otherwise derive the top 3-5
                         skills from the responsibilities. Each item is a plain string, no bullets.
12. responsibilities   — Each listed responsibility as a separate array string, no bullet chars.
13. qualifications     — Each listed qualification as a separate array string, no bullet chars.
14. special_requirements — ALL-CAPS warnings, compliance checks (MVR, background check, drug test,
                           security clearance). Each as a separate string. [] if none.
15. experience_years_min — Extract minimum from "5+ years" → 5, "3-5 years" → 3. null if absent.
16. experience_years_max — Extract maximum from "3-5 years" → 5. null if open-ended or absent.
17. industry           — Infer from context (e.g. "Automotive Electronics", "Software Engineering",
                         "Healthcare IT"). null if truly unclear.
18. tags               — Generate 5-10 concise domain/tech tags relevant to the role
                         (e.g. ["ECU", "ADAS", "ATE", "Automotive", "Embedded Systems"]).
19. source_system      — ATS/tracking platform mentioned (e.g. "Workday VNDLY"). null if absent.

OUTPUT RULES
─────────────
• Output ONLY the raw JSON object. No markdown. No code fences.
• Use null for any field that cannot be determined from the source text.
• Arrays must contain strings only, cleaned of leading "•", "-", numbers, or whitespace.
• Dates must be YYYY-MM-DD strings or null.
`;

// JSON Schema passed to Mistral's responseFormat for structured output
export const JD_JSON_SCHEMA = {
  type: "object",
  properties: {
    job_reference_id: {
      type: ["string", "null"],
      description: "Unique job/req ID from subject or body"
    },
    title: {
      type: "string",
      description: "Job title"
    },
    client_company: {
      type: ["string", "null"],
      description: "End-client employer name"
    },
    num_positions: {
      type: "integer",
      description: "Number of open positions"
    },
    employment_type: {
      type: "string",
      enum: ["contract", "full-time", "part-time", "contract-to-hire", "unknown"]
    },
    location: {
      type: "object",
      properties: {
        full_address: { type: ["string", "null"] },
        street:       { type: ["string", "null"] },
        city:         { type: ["string", "null"] },
        state:        { type: ["string", "null"] },
        country:      { type: ["string", "null"] },
        zip:          { type: ["string", "null"] }
      },
      required: ["full_address", "street", "city", "state", "country", "zip"]
    },
    work_type: {
      type: "string",
      enum: ["onsite", "remote", "hybrid"]
    },
    start_date: {
      type: ["string", "null"],
      description: "YYYY-MM-DD"
    },
    end_date: {
      type: ["string", "null"],
      description: "YYYY-MM-DD"
    },
    schedule: {
      type: ["string", "null"],
      description: "Work hours and schedule notes"
    },
    description: {
      type: ["string", "null"],
      description: "Narrative job description paragraphs"
    },
    top_skills: {
      type: "array",
      items: { type: "string" }
    },
    responsibilities: {
      type: "array",
      items: { type: "string" }
    },
    qualifications: {
      type: "array",
      items: { type: "string" }
    },
    special_requirements: {
      type: "array",
      items: { type: "string" }
    },
    experience_years_min: {
      type: ["integer", "null"]
    },
    experience_years_max: {
      type: ["integer", "null"]
    },
    industry: {
      type: ["string", "null"]
    },
    tags: {
      type: "array",
      items: { type: "string" }
    },
    source_system: {
      type: ["string", "null"]
    }
  },
  required: [
    "title",
    "num_positions",
    "employment_type",
    "work_type",
    "top_skills",
    "responsibilities",
    "qualifications",
    "special_requirements",
    "tags"
  ]
};

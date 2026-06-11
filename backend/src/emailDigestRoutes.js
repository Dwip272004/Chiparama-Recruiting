import express from "express";
import { createClient } from "@supabase/supabase-js";
import { Mistral } from "@mistralai/mistralai";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const router = express.Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

// ── Auth middleware ───────────────────────────────────────────
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

// ── AI summarize schema ───────────────────────────────────────
const DIGEST_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    action_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action:   { type: "string" },
          priority: { type: "string" },
        },
        required: ["action", "priority"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "action_items"],
};

async function aiDigestEmail({ subject, from, body }) {
  const resp = await mistral.chat.complete({
    model: "mistral-small-latest",
    temperature: 0.1,
    messages: [{
      role: "user",
      content: `You are an assistant for a recruiting agency. Analyze this email and return:
- summary: 2-3 sentence plain-English summary of what the email says
- action_items: list of concrete actions the recruiter should take, each with priority ("high", "medium", or "low")

From: ${from}
Subject: ${subject}

Email body:
${body.slice(0, 6000)}`,
    }],
    responseFormat: {
      type: "json_schema",
      jsonSchema: { name: "email_digest", schemaDefinition: DIGEST_SCHEMA },
    },
  });
  return JSON.parse(resp.choices[0].message.content);
}

// ── IMAP helper ───────────────────────────────────────────────
function makeImapClient() {
  return new ImapFlow({
    host:   process.env.IMAP_HOST,
    port:   parseInt(process.env.IMAP_PORT ?? "993"),
    secure: process.env.IMAP_SECURE !== "false",
    auth:   { user: process.env.IMAP_USER, pass: process.env.IMAP_PASSWORD },
    logger: false,
  });
}

// ── POST /email-digest/sync ───────────────────────────────────
router.post("/email-digest/sync", requireAdmin, async (req, res) => {
  const { data: senders } = await supabaseAdmin
    .from("watched_senders").select("email");
  const watchedEmails = (senders ?? []).map(s => s.email.toLowerCase());

  if (watchedEmails.length === 0) {
    return res.json({ processed: 0, message: "No watched senders configured." });
  }

  // Fetch existing message_ids to skip duplicates
  const { data: existing } = await supabaseAdmin
    .from("email_digests").select("message_id");
  const seenIds = new Set((existing ?? []).map(r => r.message_id).filter(Boolean));

  const client = makeImapClient();
  let processed = 0;
  let errors = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock(process.env.IMAP_MAILBOX ?? "INBOX");

    try {
      // Search last 60 days
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const allUids = await client.search({ since });

      if (allUids.length === 0) {
        return res.json({ processed: 0, message: "No emails found in the last 60 days." });
      }

      for (const uid of allUids) {
        try {
          // Step 1: fetch envelope only (cheap — no body download)
          const header = await client.fetchOne(
            String(uid),
            { envelope: true },
            { uid: true }
          );

          const fromAddr = (header.envelope?.from?.[0]?.address ?? "").toLowerCase();
          if (!watchedEmails.includes(fromAddr)) continue;

          // Stable ID: prefer Message-ID header, fall back to from+subject+date fingerprint
          const rawMsgId = header.envelope?.messageId;
          const msgId = rawMsgId
            ? rawMsgId.replace(/[<>\s]/g, "")
            : `${fromAddr}|${header.envelope?.subject ?? ""}|${header.envelope?.date?.toISOString() ?? uid}`;

          // Step 2: skip if already processed — no body fetch, no AI call
          if (seenIds.has(msgId)) continue;

          // Step 3: only NOW download full body for genuinely new emails
          const full = await client.fetchOne(
            String(uid),
            { source: true },
            { uid: true }
          );

          const parsed  = await simpleParser(full.source);
          const bodyRaw = parsed.text?.trim() ||
            (parsed.html ?? "")
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();

          if (!bodyRaw || bodyRaw.length < 20) continue;

          // Step 4: AI summarize — only reached for new, unprocessed emails
          let aiResult = { summary: "", action_items: [] };
          try {
            aiResult = await aiDigestEmail({
              subject: header.envelope?.subject ?? "(no subject)",
              from:    fromAddr,
              body:    bodyRaw,
            });
          } catch (aiErr) {
            console.warn("[digest] AI failed for uid", uid, aiErr.message);
            aiResult.summary = "Could not generate summary.";
          }

          const fromName = [
            header.envelope?.from?.[0]?.name,
            header.envelope?.from?.[0]?.address,
          ].filter(Boolean).join(" ").trim();

          await supabaseAdmin.from("email_digests").insert({
            message_id:   msgId,
            from_address: fromAddr,
            from_name:    fromName || fromAddr,
            subject:      header.envelope?.subject ?? "(no subject)",
            received_at:  header.envelope?.date ?? new Date().toISOString(),
            body_text:    bodyRaw,
            summary:      aiResult.summary,
            action_items: aiResult.action_items,
          });

          seenIds.add(msgId);
          processed++;
          console.log(`[digest] Processed email from ${fromAddr}: "${msg.envelope?.subject}"`);
        } catch (msgErr) {
          console.warn(`[digest] Error on uid ${uid}:`, msgErr.message);
          errors++;
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    try { await client.logout(); } catch {}
  }

  res.json({
    processed,
    errors,
    message: processed === 0
      ? "No new emails from watched senders."
      : `Processed ${processed} new email${processed !== 1 ? "s" : ""}.`,
  });
});

// ── GET /email-digest ─────────────────────────────────────────
router.get("/email-digest", requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from("email_digests")
    .select("id, from_address, from_name, subject, received_at, summary, action_items, is_read, body_text")
    .order("received_at", { ascending: false })
    .limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// ── PATCH /email-digest/:id/read ──────────────────────────────
router.patch("/email-digest/:id/read", requireAdmin, async (req, res) => {
  await supabaseAdmin.from("email_digests").update({ is_read: true }).eq("id", req.params.id);
  res.json({ ok: true });
});

// ── GET /email-digest/senders ────────────────────────────────
router.get("/email-digest/senders", requireAdmin, async (req, res) => {
  const { data } = await supabaseAdmin
    .from("watched_senders").select("*").order("created_at");
  res.json(data ?? []);
});

// ── POST /email-digest/senders ───────────────────────────────
router.post("/email-digest/senders", requireAdmin, async (req, res) => {
  const { email, label } = req.body;
  if (!email) return res.status(400).json({ error: "email required" });
  const { data, error } = await supabaseAdmin
    .from("watched_senders")
    .insert({ email: email.toLowerCase().trim(), label: label?.trim() || null })
    .select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── DELETE /email-digest/senders/:id ────────────────────────
router.delete("/email-digest/senders/:id", requireAdmin, async (req, res) => {
  await supabaseAdmin.from("watched_senders").delete().eq("id", req.params.id);
  res.json({ ok: true });
});

export default router;

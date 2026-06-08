// ============================================================
// IMAP inbox poller — checks every 60s for new JD emails
// Works with any provider: Gmail, Outlook, Zoho, custom, etc.
// Run alongside the webhook server OR standalone:
//   node src/emailPoller.js
// ============================================================

import "dotenv/config";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { parseAndSaveJob } from "./parseJob.js";

const POLL_MS      = parseInt(process.env.POLL_INTERVAL_MS ?? "60000");
const SUBJECT_KEY  = (process.env.JD_SUBJECT_KEYWORD ?? "JD For Automation").toLowerCase();
const MAILBOX      = process.env.IMAP_MAILBOX ?? "INBOX";

// Track UIDs that already failed so we don't spam retries on a broken email
const failedUids = new Set();

function makeClient() {
  return new ImapFlow({
    host:   process.env.IMAP_HOST,
    port:   parseInt(process.env.IMAP_PORT ?? "993"),
    secure: process.env.IMAP_SECURE !== "false",  // true by default (port 993)
    auth: {
      user: process.env.IMAP_USER,
      pass: process.env.IMAP_PASSWORD,
    },
    logger: false,   // set to console for verbose IMAP debug output
  });
}

// ──────────────────────────────────────────────
// One poll cycle: connect → search → process → disconnect
// ──────────────────────────────────────────────
async function pollOnce() {
  const client = makeClient();

  try {
    await client.connect();
    const lock = await client.getMailboxLock(MAILBOX);

    try {
      // Find unseen emails whose subject contains the trigger keyword
      const uids = await client.search({ unseen: true });

      if (uids.length === 0) {
        console.log(`[poller] No new emails.`);
        return;
      }

      console.log(`[poller] ${uids.length} unseen email(s) — scanning subjects...`);

      for (const uid of uids) {
        // Fetch headers first (cheap) to check subject before downloading body
        const msg = await client.fetchOne(String(uid), { envelope: true, source: true }, { uid: true });

        const subject = msg.envelope?.subject ?? "";
        if (!subject.toLowerCase().includes(SUBJECT_KEY)) continue;
        if (failedUids.has(uid)) { console.log(`[poller] Skipping UID ${uid} (previously failed)`); continue; }

        console.log(`[poller] Matched: "${subject}"`);

        // Parse full email body
        const parsed = await simpleParser(msg.source);
        const body =
          parsed.text?.trim() ||
          parsed.html?.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                      .replace(/<[^>]+>/g, " ")
                      .replace(/\s+/g, " ")
                      .trim();

        if (!body) {
          console.warn(`[poller] UID ${uid}: empty body, skipping.`);
          continue;
        }

        try {
          const job = await parseAndSaveJob(body);
          console.log(`[poller] Saved: "${job.title}" (id: ${job.id})`);

          // Mark as read so it won't be picked up again
          await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        } catch (err) {
          console.error(`[poller] Parse/save failed for UID ${uid}:`, err.message);
          failedUids.add(uid);  // skip on next poll; restart poller to retry
        }
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.error("[poller] IMAP error:", err.message);
  } finally {
    try { await client.logout(); } catch {}
  }
}

// ──────────────────────────────────────────────
// Poll loop
// ──────────────────────────────────────────────
export async function startPoller() {
  console.log(`[poller] Starting — watching "${process.env.IMAP_USER}" every ${POLL_MS / 1000}s`);
  console.log(`[poller] Trigger subject: "${SUBJECT_KEY}"`);
  await pollOnce();
  setInterval(pollOnce, POLL_MS);
}

// Allow running standalone: node src/emailPoller.js
if (process.argv[1].endsWith("emailPoller.js")) {
  startPoller().catch(err => {
    console.error("[poller] Fatal:", err.message);
    process.exit(1);
  });
}

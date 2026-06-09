// ============================================================
// Webhook server — receives inbound emails from Postmark
// (easily adapted for SendGrid, Mailgun, or n8n HTTP node)
// ============================================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import { parseAndSaveJob } from "./parseJob.js";
import { startPoller } from "./emailPoller.js";
import adminRoutes     from "./adminRoutes.js";
import resumeRoutes    from "./resumeRoutes.js";
import submissionRoutes from "./submissionRoutes.js";
import matchRoutes      from "./matchRoutes.js";
import { verifyTransporter } from "./emailService.js";

const app = express();

// Allow requests from the frontend (dev + production)
const allowedOrigins = [
  "http://localhost:5173",
  "https://chiparama-recruiting.vercel.app",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const JD_SUBJECT_KEYWORD = process.env.JD_SUBJECT_KEYWORD ?? "JD For Automation";
const PORT = process.env.PORT ?? 3001;

// ──────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));

// ──────────────────────────────────────────────
// Admin API routes (JWT-protected)
// ──────────────────────────────────────────────
app.use("/admin", adminRoutes);
app.use("/", submissionRoutes);
app.use("/", matchRoutes);
app.use("/", resumeRoutes);

// ──────────────────────────────────────────────
// Postmark inbound email webhook
// Configure Postmark → Inbound → Webhook URL → https://yourserver.com/webhook/email
//
// SendGrid adaptation: read from req.body[0].subject / req.body[0].text instead
// n8n adaptation: POST from the "Send HTTP Request" node with the same JSON shape
// ──────────────────────────────────────────────
app.post("/webhook/email", async (req, res) => {
  try {
    // Postmark sends a flat JSON body; SendGrid sends an array
    const payload = Array.isArray(req.body) ? req.body[0] : req.body;

    const subject  = payload.Subject  ?? payload.subject  ?? "";
    const textBody = payload.TextBody ?? payload.text      ?? "";
    const htmlBody = payload.HtmlBody ?? payload.html      ?? "";

    // Only process emails matching the trigger subject
    if (!subject.toLowerCase().includes(JD_SUBJECT_KEYWORD.toLowerCase())) {
      return res.status(200).json({ status: "skipped", reason: "subject_mismatch" });
    }

    // Prefer plain text; strip HTML as fallback
    const emailBody = textBody.trim() || stripHtml(htmlBody);

    if (!emailBody) {
      return res.status(400).json({ error: "empty_body" });
    }

    const job = await parseAndSaveJob(emailBody);
    return res.status(200).json({ status: "success", jobId: job.id, title: job.title });

  } catch (err) {
    console.error("[webhook] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// Manual test endpoint — POST a raw email body
// curl -X POST http://localhost:3001/test \
//   -H "Content-Type: application/json" \
//   -d '{"emailBody": "Job Title - Electronics Lab Technician..."}'
// ──────────────────────────────────────────────
app.post("/test", async (req, res) => {
  const { emailBody } = req.body;
  if (!emailBody) return res.status(400).json({ error: "emailBody required" });

  try {
    const job = await parseAndSaveJob(emailBody);
    return res.status(200).json({ status: "success", job });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
function stripHtml(html = "") {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

app.listen(PORT, () => {
  console.log(`JD Parser server running on http://localhost:${PORT}`);
  verifyTransporter();
  if (process.env.IMAP_HOST && process.env.IMAP_USER) {
    startPoller();
  }
});

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT ?? "465"),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const FROM = `"${process.env.SMTP_FROM_NAME ?? "Chiparama Recruiting"}" <${process.env.SMTP_USER}>`;
const PORTAL = process.env.FRONTEND_URL ?? "http://localhost:5173";

function base(body) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8f9fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 8px rgba(0,0,0,.08)">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 32px">
      <p style="margin:0;color:#fff;font-size:20px;font-weight:700;letter-spacing:-.3px">Chiparama Recruiting</p>
      <p style="margin:4px 0 0;color:#c7d2fe;font-size:12px">Recruitment Operating System</p>
    </div>
    <!-- Body -->
    <div style="padding:32px">
      ${body}
    </div>
    <!-- Footer -->
    <div style="padding:20px 32px;background:#f8f9fb;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center">
        © ${new Date().getFullYear()} Chiparama Recruiting ·
        <a href="${PORTAL}" style="color:#6366f1;text-decoration:none">Open Portal</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function btn(href, label) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#4f46e5;color:#fff;font-size:14px;font-weight:600;border-radius:10px;text-decoration:none">${label}</a>`;
}

function badge(text, color = "#4f46e5") {
  return `<span style="display:inline-block;padding:3px 10px;background:${color}22;color:${color};border-radius:20px;font-size:11px;font-weight:700;text-transform:capitalize">${text}</span>`;
}

const STAGE_COLOR = {
  submitted:            "#3b82f6",
  reviewing:            "#eab308",
  shortlisted:          "#8b5cf6",
  interview_scheduled:  "#6366f1",
  interview_completed:  "#6366f1",
  client_submitted:     "#06b6d4",
  offer_extended:       "#14b8a6",
  offer_accepted:       "#10b981",
  placed:               "#22c55e",
  rejected:             "#ef4444",
  withdrawn:            "#6b7280",
};

// ── Email: stage changed ─────────────────────────────────────
export async function sendStageChangedEmail({ to, vendorName, candidateName, jobTitle, fromStage, toStage, feedback }) {
  const color = STAGE_COLOR[toStage] ?? "#4f46e5";
  const stageLabel = toStage.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const fromLabel  = fromStage?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "—";

  const html = base(`
    <h2 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111827">Submission Update</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px">A candidate's pipeline stage has been updated</p>

    <div style="background:#f9fafb;border-radius:12px;padding:20px;margin-bottom:20px">
      <p style="margin:0 0 12px;font-size:13px;color:#374151">
        <b style="color:#111827">${candidateName}</b> has been moved from
        ${badge(fromLabel, STAGE_COLOR[fromStage] ?? "#6b7280")} to ${badge(stageLabel, color)}
        for the role <b style="color:#111827">${jobTitle}</b>.
      </p>
      ${feedback ? `<p style="margin:12px 0 0;font-size:13px;color:#374151"><b>Admin feedback:</b> ${feedback}</p>` : ""}
    </div>

    ${btn(`${PORTAL}/vendor/submissions`, "View Submission")}
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[${stageLabel}] ${candidateName} — ${jobTitle}`,
    html,
  });
  console.log(`[email] Stage change → ${to}: ${candidateName} → ${toStage}`);
}

// ── Email: interview scheduled ───────────────────────────────
export async function sendInterviewScheduledEmail({ to, candidateName, jobTitle, interviewType, scheduledAt, durationMins, interviewer, locationOrLink, instructions, round }) {
  const dateStr = scheduledAt
    ? new Date(scheduledAt).toLocaleString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" })
    : "TBD";

  const html = base(`
    <h2 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111827">Interview Scheduled</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px">An interview has been scheduled for your candidate</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin-bottom:20px">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:4px 0;color:#6b7280;width:130px">Candidate</td><td style="color:#111827;font-weight:600">${candidateName}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Job</td><td style="color:#111827;font-weight:600">${jobTitle}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Round</td><td style="color:#111827">Round ${round ?? 1} — ${interviewType} Interview</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Date & Time</td><td style="color:#111827;font-weight:600">${dateStr}</td></tr>
        ${durationMins ? `<tr><td style="padding:4px 0;color:#6b7280">Duration</td><td style="color:#111827">${durationMins} minutes</td></tr>` : ""}
        ${interviewer  ? `<tr><td style="padding:4px 0;color:#6b7280">Interviewer</td><td style="color:#111827">${interviewer}</td></tr>` : ""}
        ${locationOrLink ? `<tr><td style="padding:4px 0;color:#6b7280">Link / Location</td><td><a href="${locationOrLink}" style="color:#4f46e5">${locationOrLink}</a></td></tr>` : ""}
      </table>
      ${instructions ? `<p style="margin:12px 0 0;font-size:12px;color:#374151;background:#fff;padding:10px;border-radius:8px"><b>Instructions:</b> ${instructions}</p>` : ""}
    </div>

    ${btn(`${PORTAL}/vendor/submissions`, "View Submissions")}
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Interview Scheduled: ${candidateName} — ${jobTitle} (Round ${round ?? 1})`,
    html,
  });
  console.log(`[email] Interview scheduled → ${to}: ${candidateName}`);
}

// ── Email: job assigned ──────────────────────────────────────
export async function sendJobAssignedEmail({ to, vendorName, jobTitle, jobLocation, deadline, maxSubmissions, priority, instructions }) {
  const deadlineStr = deadline
    ? new Date(deadline).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "None";

  const html = base(`
    <h2 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111827">New Job Assignment</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px">You have been assigned a new open position</p>

    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin-bottom:20px">
      <p style="margin:0 0 6px;font-size:18px;font-weight:700;color:#1e40af">${jobTitle}</p>
      ${jobLocation ? `<p style="margin:0 0 14px;font-size:13px;color:#3b82f6">📍 ${jobLocation}</p>` : ""}
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:4px 0;color:#6b7280;width:150px">Submission Deadline</td><td style="color:#111827;font-weight:600">${deadlineStr}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Max Submissions</td><td style="color:#111827">${maxSubmissions ?? 10}</td></tr>
        <tr><td style="padding:4px 0;color:#6b7280">Priority</td><td>${badge(priority ?? "normal", priority === "urgent" ? "#ef4444" : priority === "high" ? "#f97316" : "#4f46e5")}</td></tr>
      </table>
      ${instructions ? `<p style="margin:14px 0 0;font-size:12px;color:#374151;background:#fff;padding:10px;border-radius:8px"><b>Instructions from admin:</b> ${instructions}</p>` : ""}
    </div>

    ${btn(`${PORTAL}/vendor/jobs`, "View Assigned Jobs")}
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `New Assignment: ${jobTitle}`,
    html,
  });
  console.log(`[email] Job assigned → ${to}: ${jobTitle}`);
}

// ── Email: vendor account created ────────────────────────────
export async function sendVendorWelcomeEmail({ to, vendorName, password }) {
  const html = base(`
    <h2 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#111827">Welcome to Chiparama Recruiting</h2>
    <p style="margin:0 0 24px;color:#6b7280;font-size:14px">Your vendor account has been created</p>

    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;padding:20px;margin-bottom:20px">
      <p style="margin:0 0 12px;font-size:13px;color:#374151">Here are your login credentials:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr><td style="padding:6px 0;color:#6b7280;width:120px">Portal URL</td><td><a href="${PORTAL}/login" style="color:#4f46e5">${PORTAL}/login</a></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Email</td><td style="color:#111827;font-weight:600">${to}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Password</td><td style="font-family:monospace;font-size:15px;font-weight:700;color:#7c3aed;background:#fff;padding:4px 8px;border-radius:6px;border:1px solid #e9d5ff">${password}</td></tr>
      </table>
      <p style="margin:14px 0 0;font-size:11px;color:#9ca3af">Please save your credentials. You can change your password after logging in.</p>
    </div>

    ${btn(`${PORTAL}/login`, "Log In Now")}
  `);

  await transporter.sendMail({
    from: FROM,
    to,
    subject: "Your Chiparama Recruiting Portal Access",
    html,
  });
  console.log(`[email] Welcome email → ${to}`);
}

export async function verifyTransporter() {
  try {
    await transporter.verify();
    console.log("[email] SMTP connection verified");
    return true;
  } catch (err) {
    console.warn("[email] SMTP not configured:", err.message);
    return false;
  }
}

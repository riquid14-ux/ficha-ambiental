import fs from "node:fs/promises";
import nodemailer from "nodemailer";

const incidentPath = process.argv[2];
if (!incidentPath) throw new Error("Uso: node ops/notify-incident.mjs <incident.json>");

const incident = JSON.parse(await fs.readFile(incidentPath, "utf8"));
const recipients = (process.env.INCIDENT_EMAIL_RECIPIENTS ?? "")
  .split(",")
  .map(value => value.trim())
  .filter(Boolean);

async function sendEmail() {
  if (recipients.length < 2) {
    console.warn("[incident] Configure pelo menos dois INCIDENT_EMAIL_RECIPIENTS");
    return { sent: false, reason: "recipients_not_configured" };
  }

  const required = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) {
    console.warn(`[incident] SMTP incompleto: ${missing.join(", ")}`);
    return { sent: false, reason: "smtp_not_configured" };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: recipients,
    subject: `[CRÍTICO] Crash-loop ${incident.appName} — ${incident.incidentId}`,
    text: [
      `Foi detectado um crash-loop em ${incident.appName}.`,
      `Incidente: ${incident.incidentId}`,
      `Data UTC: ${incident.detectedAt}`,
      `Estado PM2: ${incident.pm2Status}`,
      `Reinícios na janela: ${incident.restartCount}`,
      `Backup: ${incident.backupStatus}`,
      `Recuperação: ${incident.recoveryStatus}`,
      `Directório seguro do incidente: ${incident.incidentDirectory}`,
      "",
      "Excerto sanitizado:",
      incident.logExcerpt,
    ].join("\n"),
  });

  return { sent: true };
}

async function dispatchGitHubIncident() {
  const token = process.env.GITHUB_INCIDENT_TOKEN;
  const repository = process.env.GITHUB_INCIDENT_REPOSITORY;
  if (!token || !repository) {
    console.warn("[incident] Dispatch GitHub não configurado");
    return { sent: false, reason: "github_not_configured" };
  }

  const response = await fetch(`https://api.github.com/repos/${repository}/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "start-campus-environmental-watchdog",
    },
    body: JSON.stringify({
      event_type: "production_crash",
      client_payload: {
        incident_id: incident.incidentId,
        app_name: incident.appName,
        detected_at: incident.detectedAt,
        pm2_status: incident.pm2Status,
        restart_count: incident.restartCount,
        backup_status: incident.backupStatus,
        recovery_status: incident.recoveryStatus,
        log_excerpt: String(incident.logExcerpt).slice(0, 12000),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub dispatch falhou (${response.status})`);
  }
  return { sent: true };
}

const results = await Promise.allSettled([sendEmail(), dispatchGitHubIncident()]);
const failed = results.filter(result => result.status === "rejected");
for (const result of failed) console.error("[incident]", result.reason?.message ?? result.reason);
const delivered = results.filter(result => result.status === "fulfilled" && result.value?.sent === true);
if (delivered.length === 0) {
  console.error("[incident] Nenhum canal de alerta ficou disponível");
  process.exitCode = 1;
}

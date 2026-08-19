import nodemailer from "nodemailer";
import * as db from "./db";

// Email configuration - stored in app_settings, configurable by admin
// Default: uses a generic SMTP config that IT can replace
interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
}

const DEFAULT_CONFIG: EmailConfig = {
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT) || 587,
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  fromEmail: process.env.SMTP_FROM || "apoioamb@startcampus.pt",
  fromName: "Plataforma de Gestão Ambiental - Start Campus",
  enabled: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
};

async function getEmailConfig(): Promise<EmailConfig> {
  try {
    const database = await db.getDb();
    if (!database) return DEFAULT_CONFIG;
    const { sql } = await import("drizzle-orm");
    const rows = await database.execute(sql`SELECT \`key\`, value FROM app_settings WHERE \`key\` LIKE 'email_%'`);
    const settings: Record<string, string> = {};
    for (const row of rows as any[]) {
      settings[row.key] = row.value;
    }
    return {
      smtpHost: settings.email_smtp_host || DEFAULT_CONFIG.smtpHost,
      smtpPort: Number(settings.email_smtp_port) || DEFAULT_CONFIG.smtpPort,
      smtpUser: settings.email_smtp_user || DEFAULT_CONFIG.smtpUser,
      smtpPass: settings.email_smtp_pass || DEFAULT_CONFIG.smtpPass,
      fromEmail: settings.email_from || DEFAULT_CONFIG.fromEmail,
      fromName: settings.email_from_name || DEFAULT_CONFIG.fromName,
      enabled: settings.email_enabled === "true" || DEFAULT_CONFIG.enabled,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function createTransporter(config: EmailConfig) {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
  });
}

// Base HTML template for all emails
function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="color: #16a34a; margin: 0;">Plataforma de Gestão Ambiental</h2>
      <p style="color: #666; font-size: 12px; margin: 4px 0 0;">Start Campus — Sines, Portugal</p>
    </div>
    <hr style="border: none; border-top: 2px solid #16a34a; margin: 20px 0;">
    ${body}
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="color: #999; font-size: 11px; text-align: center;">
      Este email foi enviado automaticamente pela Plataforma de Gestão Ambiental.<br>
      Em caso de dúvida, contacte <a href="mailto:apoioamb@startcampus.pt">apoioamb@startcampus.pt</a>
    </p>
  </div>
</body>
</html>`;
}

// ─── Email Templates ──────────────────────────────────────────────────────

export async function sendFichaSubmittedNotification(
  submissionId: number,
  weekNumber: number,
  weekYear: number,
  companyName: string,
  projectCode: string,
  raaEmails: string[]
): Promise<boolean> {
  const config = await getEmailConfig();
  if (!config.enabled || raaEmails.length === 0) {
    console.log("[Email] Notifications disabled or no RAA emails. Skipping.");
    return false;
  }
  const subject = `[Plataforma de Gestão Ambiental] Nova Ficha Submetida — ${projectCode} Semana ${weekNumber}/${weekYear}`;
  const body = `
    <h3 style="color: #333;">Nova Ficha de Controlo Submetida</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666; width: 40%;">Projeto:</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${projectCode}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Semana:</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${weekNumber}/${weekYear}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Empresa:</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${companyName}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Ficha ID:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">#${submissionId}</td></tr>
    </table>
    <p style="color: #333;">Esta ficha aguarda a sua revisão na plataforma.</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="https://ambientfich.co/revisao" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Rever Ficha</a>
    </div>`;
  try {
    const transporter = createTransporter(config);
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: raaEmails.join(", "),
      subject,
      html: wrapHtml(subject, body),
    });
    console.log(`[Email] Ficha submitted notification sent to ${raaEmails.length} RAA(s)`);
    return true;
  } catch (err) {
    console.warn("[Email] Failed to send ficha submitted notification:", err);
    return false;
  }
}

export async function sendFichaReviewedNotification(
  submissionId: number,
  weekNumber: number,
  weekYear: number,
  projectCode: string,
  status: "approved" | "rejected",
  reviewNotes: string | null,
  submitterEmail: string
): Promise<boolean> {
  const config = await getEmailConfig();
  if (!config.enabled || !submitterEmail) {
    console.log("[Email] Notifications disabled or no submitter email. Skipping.");
    return false;
  }
  const isApproved = status === "approved";
  const statusLabel = isApproved ? "Aprovada" : "Rejeitada";
  const statusColor = isApproved ? "#16a34a" : "#dc2626";
  const subject = `[Plataforma de Gestão Ambiental] Ficha ${statusLabel} — ${projectCode} Semana ${weekNumber}/${weekYear}`;
  const body = `
    <h3 style="color: #333;">Ficha de Controlo ${statusLabel}</h3>
    <div style="background: ${isApproved ? '#f0fdf4' : '#fef2f2'}; border-left: 4px solid ${statusColor}; padding: 12px 16px; margin: 15px 0; border-radius: 4px;">
      <strong style="color: ${statusColor};">${isApproved ? '✓' : '✗'} ${statusLabel}</strong>
    </div>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666; width: 40%;">Projeto:</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${projectCode}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Semana:</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${weekNumber}/${weekYear}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Ficha ID:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">#${submissionId}</td></tr>
    </table>
    ${reviewNotes ? `<div style="background: #f9fafb; padding: 12px 16px; border-radius: 4px; margin: 15px 0;"><strong>Notas da revisão:</strong><p style="margin: 8px 0 0; color: #333;">${reviewNotes}</p></div>` : ''}
    ${!isApproved ? '<p style="color: #333;">Por favor, reveja as observações e resubmeta a ficha corrigida.</p><div style="text-align: center; margin: 20px 0;"><a href="https://ambientfich.co/ficha" style="display: inline-block; background: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Corrigir Ficha</a></div>' : '<p style="color: #333;">A ficha foi aprovada com sucesso. Não é necessária nenhuma ação adicional.</p>'}`;
  try {
    const transporter = createTransporter(config);
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: submitterEmail,
      subject,
      html: wrapHtml(subject, body),
    });
    console.log(`[Email] Ficha ${status} notification sent to ${submitterEmail}`);
    return true;
  } catch (err) {
    console.warn("[Email] Failed to send ficha reviewed notification:", err);
    return false;
  }
}

export async function sendInvitationEmail(
  recipientEmail: string,
  recipientName: string | null,
  companyName: string,
  roleName: string,
  invitedByName: string
): Promise<boolean> {
  const config = await getEmailConfig();
  if (!config.enabled) {
    console.log("[Email] Notifications disabled. Skipping invitation email.");
    return false;
  }
  const subject = `[Plataforma de Gestão Ambiental] Convite — Start Campus`;
  const body = `
    <h3 style="color: #333;">Bem-vindo à Plataforma de Gestão Ambiental</h3>
    <p style="color: #333;">Olá${recipientName ? ` ${recipientName}` : ''},</p>
    <p style="color: #333;">Foi convidado(a) por <strong>${invitedByName}</strong> para aceder à Plataforma de Gestão Ambiental da Start Campus.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666; width: 40%;">Empresa:</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${companyName}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Função:</td><td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;">${roleName}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #eee; color: #666;">Email de acesso:</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${recipientEmail}</td></tr>
    </table>
    <p style="color: #333;">Para aceder à plataforma, utilize o seu email e a palavra-passe inicial: <strong>123456</strong></p>
    <p style="color: #e11d48; font-size: 13px;">⚠️ Por razões de segurança, altere a sua palavra-passe no primeiro acesso.</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="https://ambientfich.co" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Aceder à Plataforma</a>
    </div>`;
  try {
    const transporter = createTransporter(config);
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: recipientEmail,
      subject,
      html: wrapHtml(subject, body),
    });
    console.log(`[Email] Invitation sent to ${recipientEmail}`);
    return true;
  } catch (err) {
    console.warn("[Email] Failed to send invitation email:", err);
    return false;
  }
}

export async function sendAccessDeniedNotification(
  attemptEmail: string
): Promise<boolean> {
  const config = await getEmailConfig();
  if (!config.enabled) return false;
  const subject = `[Plataforma de Gestão Ambiental] Tentativa de acesso não autorizada — ${attemptEmail}`;
  const body = `
    <h3 style="color: #333;">Tentativa de Acesso Registada</h3>
    <p style="color: #333;">O email <strong>${attemptEmail}</strong> tentou aceder à plataforma mas não tem permissões.</p>
    <p style="color: #666; font-size: 13px;">Se pretende conceder acesso, crie um convite na secção Administração da plataforma.</p>`;
  try {
    const transporter = createTransporter(config);
    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: config.fromEmail, // Send to admin email
      subject,
      html: wrapHtml(subject, body),
    });
    return true;
  } catch (err) {
    console.warn("[Email] Failed to send access denied notification:", err);
    return false;
  }
}

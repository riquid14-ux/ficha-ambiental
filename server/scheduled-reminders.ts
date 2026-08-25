import { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";
import { sendDeadlineReminderEmail } from "./email";
import { daysUntilDeadline, isPlanReminderDay } from "./plan-reminders";

/**
 * Deadline reminder handler - called by Heartbeat cron daily at 08:00 UTC.
 * Checks calendar events with upcoming deadlines and sends email notifications
 * to the responsible person at 30 days, 15 days, and 7 days before the deadline.
 */
export async function deadlineReminderHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user || !(user as any).isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    const now = new Date();

    // Get all active calendar events
    const events = await db.getCalendarEvents(undefined, false);
    const reminders: Array<{ event: string; daysLeft: number; recipient: string }> = [];

    for (const event of events) {
      const deadline = event.nextDate || event.firstDate;
      if (!deadline) continue;

      const daysLeft = daysUntilDeadline(deadline, now);

      // Send reminders at 30, 15, and 7 days before
      if (isPlanReminderDay(daysLeft)) {
        const recipients: Array<{ email: string; name: string; userId: number | null }> = [];

        if (event.ownerId) {
          const owner = await db.getUserById(event.ownerId);
          if (owner?.accountStatus === "active" && owner.email) {
            recipients.push({ email: owner.email, name: owner.fullName || owner.name || owner.email, userId: owner.id });
          }
        }

        if (event.sourceType === "monitoring_plan" && event.sourceId) {
          const plan = await db.getMonitoringPlanById(event.sourceId);
          if (plan?.supportEmail && !recipients.some(item => item.email.toLowerCase() === plan.supportEmail!.toLowerCase())) {
            recipients.push({ email: plan.supportEmail, name: plan.supportName || plan.supportCompany || plan.supportEmail, userId: null });
          }
        }

        for (const recipient of recipients) {
          const claimed = await db.claimCalendarReminder({
            eventId: event.id,
            deadlineDate: deadline,
            reminderDays: daysLeft,
            recipientUserId: recipient.userId,
            recipientEmail: recipient.email,
          });
          if (!claimed) continue;
          try {
            await sendDeadlineReminderEmail({
              to: recipient.email,
              recipientName: recipient.name,
              eventName: event.name,
              daysLeft,
              deadlineDate: new Date(deadline).toLocaleDateString("pt-PT"),
              projectId: event.projectId,
              category: event.category,
            });
            reminders.push({ event: event.name, daysLeft, recipient: recipient.email });
          } catch (emailErr) {
            await db.releaseCalendarReminderClaim(event.id, deadline, daysLeft, recipient.email);
            console.error(`[Deadline Reminder] Failed to send for "${event.name}":`, emailErr);
          }
        }
      }
    }

    // Notify owner with summary of urgent deadlines (7 days or less)
    const urgentEvents = events.filter((e) => {
      const dl = e.nextDate || e.firstDate;
      if (!dl) return false;
      const days = daysUntilDeadline(dl, now);
      return days > 0 && days <= 7;
    });

    if (urgentEvents.length > 0) {
      await notifyOwner({
        title: `⚠️ ${urgentEvents.length} prazo(s) a vencer em 7 dias ou menos`,
        content: urgentEvents.map((e) => {
          const dl = e.nextDate || e.firstDate;
          const days = daysUntilDeadline(dl!, now);
          return `• ${e.name} — ${days} dia(s) (${new Date(dl!).toLocaleDateString("pt-PT")})`;
        }).join("\n"),
      });
    }

    return res.json({
      ok: true,
      date: now.toISOString(),
      remindersSent: reminders.length,
      reminders,
      urgentDeadlines: urgentEvents.length,
    });
  } catch (error: any) {
    console.error("[Deadline Reminder] Error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}

/**
 * Weekly reminder handler - called by Heartbeat cron every Monday at 09:00 UTC.
 * Checks which companies have NOT submitted their weekly form and notifies the owner.
 */
export async function weeklyReminderHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user || !(user as any).isCron) {
      return res.status(403).json({ error: "cron-only" });
    }

    // Get current week info
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const weekYear = now.getFullYear();

    // Get all active companies
    const companies = await db.getAllCompanies();
    const activeCompanies = companies.filter((c) => c.active === 1);

    // Check which have submitted this week
    const pendingCompanies: string[] = [];
    for (const company of activeCompanies) {
      const submission = await db.getSubmissionForWeek(company.id, weekNumber, weekYear);
      if (!submission || submission.status !== "submitted") {
        pendingCompanies.push(company.name);
      }
    }

    if (pendingCompanies.length > 0) {
      // Notify owner about pending submissions
      await notifyOwner({
        title: `⚠️ Fichas Ambientais Pendentes - Semana ${weekNumber}/${weekYear}`,
        content: `As seguintes empresas ainda não submeteram a ficha semanal:\n\n${pendingCompanies.map((c) => `• ${c}`).join("\n")}\n\nTotal: ${pendingCompanies.length} empresa(s) pendente(s) de ${activeCompanies.length} ativa(s).`,
      });
    }

    return res.json({
      ok: true,
      weekNumber,
      weekYear,
      totalActive: activeCompanies.length,
      pending: pendingCompanies.length,
      pendingCompanies,
    });
  } catch (error: any) {
    console.error("[Scheduled Reminder] Error:", error);
    return res.status(500).json({
      error: error.message || "Internal error",
      timestamp: new Date().toISOString(),
    });
  }
}

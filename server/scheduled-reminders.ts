import { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { notifyOwner } from "./_core/notification";
import * as db from "./db";

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
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
}

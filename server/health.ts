import type { Express } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

export type HealthState = {
  status: "ready" | "not_ready";
  checks: {
    database: "ok" | "unavailable";
  };
};

async function probeDatabase(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("database_unavailable");
  await db.execute(sql`SELECT 1`);
}

export async function checkReadiness(
  databaseProbe: () => Promise<void> = probeDatabase,
): Promise<HealthState> {
  try {
    await databaseProbe();
    return { status: "ready", checks: { database: "ok" } };
  } catch {
    return { status: "not_ready", checks: { database: "unavailable" } };
  }
}

export function registerHealthRoutes(app: Express): void {
  app.get("/api/health/live", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/api/health/ready", async (_req, res) => {
    const state = await checkReadiness();
    res.status(state.status === "ready" ? 200 : 503).json(state);
  });
}

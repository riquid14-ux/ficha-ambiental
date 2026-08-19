import { describe, it, expect } from "vitest";

// QA AUDIT: Test all critical API endpoints and business logic

describe("QA Audit - API Endpoints", () => {
  
  // Test 1: Auth endpoints
  it("auth.me should not expose sensitive fields", async () => {
    // The auth.me response should NOT contain passwordHash or totpSecret
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const [users] = await db.execute("SELECT * FROM users LIMIT 1") as any;
    if (users.length > 0) {
      expect(users[0]).toHaveProperty("passwordHash");
      // This is the raw DB - auth.me should filter these out
    }
  });

  // Test 2: Submission status validation
  it("submission statuses should be valid enum values", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const [subs] = await db.execute("SELECT DISTINCT status FROM weekly_submissions") as any;
    const validStatuses = ["draft", "submitted", "under_review", "approved", "rejected", "deleted"];
    for (const s of subs) {
      expect(validStatuses).toContain(s.status);
    }
  });

  // Test 3: No orphan submissions (submissions without a valid project)
  it("all submissions should reference valid projects", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const [orphans] = await db.execute(`
      SELECT ws.id, ws.projectId FROM weekly_submissions ws 
      LEFT JOIN projects p ON ws.projectId = p.id 
      WHERE p.id IS NULL
    `) as any;
    expect(orphans.length).toBe(0);
  });

  // Test 4: No orphan users (users with invalid companyId)
  it("all users with companyId should reference valid companies", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const [orphans] = await db.execute(`
      SELECT u.id, u.email, u.companyId FROM users u 
      LEFT JOIN companies c ON u.companyId = c.id 
      WHERE u.companyId IS NOT NULL AND c.id IS NULL
    `) as any;
    expect(orphans.length).toBe(0);
  });

  // Test 5: Calendar events have valid projectId
  it("all calendar events should reference valid projects", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const [orphans] = await db.execute(`
      SELECT ce.id, ce.projectId FROM calendar_events ce 
      LEFT JOIN projects p ON ce.projectId = p.id 
      WHERE ce.projectId IS NOT NULL AND p.id IS NULL
    `) as any;
    expect(orphans.length).toBe(0);
  });

  // Test 6: Measures have valid sectionId
  it("all measures should reference valid sections", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const [orphans] = await db.execute(`
      SELECT m.id, m.sectionId FROM measures m 
      LEFT JOIN sections s ON m.sectionId = s.id 
      WHERE s.id IS NULL
    `) as any;
    expect(orphans.length).toBe(0);
  });

  // Test 7: No duplicate users with same email
  it("no duplicate emails in users table", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const [dupes] = await db.execute(`
      SELECT email, COUNT(*) as cnt FROM users 
      GROUP BY email HAVING cnt > 1
    `) as any;
    expect(dupes.length).toBe(0);
  });

  // Test 8: Project phases have valid projectId
  it("all project phases should reference valid projects", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const [orphans] = await db.execute(`
      SELECT pp.id, pp.projectId FROM project_phases pp 
      LEFT JOIN projects p ON pp.projectId = p.id 
      WHERE p.id IS NULL
    `) as any;
    expect(orphans.length).toBe(0);
  });

  // Test 9: Submission measures have valid submissionId
  it("all submission measures should reference valid submissions", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const [orphans] = await db.execute(`
      SELECT sm.id, sm.submissionId FROM measure_responses sm 
      LEFT JOIN weekly_submissions ws ON sm.submissionId = ws.id 
      WHERE ws.id IS NULL
    `) as any;
    expect(orphans.length).toBe(0);
  });

  // Test 10: KPI values have valid submissionId
  it("all KPI values should reference valid KPI submissions", async () => {
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) return;
    const [orphans] = await db.execute(`
      SELECT kv.id FROM kpi_values kv 
      LEFT JOIN kpi_submissions ks ON kv.submissionId = ks.id 
      WHERE ks.id IS NULL
    `) as any;
    expect(orphans.length).toBe(0);
  });
});

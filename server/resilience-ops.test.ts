import { describe, expect, it } from "vitest";
import { evaluateCrashLoop, redactSensitive } from "../ops/resilience-core.mjs";

describe("operational resilience", () => {
  it("redacts credentials and connection strings before external notification", () => {
    const input = [
      "Authorization: Bearer abc.def.ghi",
      "Cookie: app_session_id=secret-cookie",
      "password=super-secret",
      "mysql://user:pass@db.internal/platform",
    ].join("\n");

    const output = redactSensitive(input);
    expect(output).not.toContain("abc.def.ghi");
    expect(output).not.toContain("secret-cookie");
    expect(output).not.toContain("super-secret");
    expect(output).not.toContain("user:pass");
    expect(output.match(/\[REDACTED\]/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("detects three restarts in five minutes", () => {
    const now = Date.now();
    const result = evaluateCrashLoop({
      previousState: { lastRestartCount: 0, restartEvents: [], lastIncidentAt: 0 },
      restartCount: 3,
      status: "online",
      now,
      threshold: 3,
      windowMs: 300_000,
      cooldownMs: 1_800_000,
    });

    expect(result.shouldCreateIncident).toBe(true);
    expect(result.state.restartEvents).toHaveLength(3);
  });

  it("deduplicates repeated alerts during the cooldown", () => {
    const now = Date.now();
    const result = evaluateCrashLoop({
      previousState: {
        lastRestartCount: 3,
        restartEvents: [now - 60_000, now - 30_000, now - 10_000],
        lastIncidentAt: now - 120_000,
      },
      restartCount: 3,
      status: "errored",
      now,
      threshold: 3,
      windowMs: 300_000,
      cooldownMs: 1_800_000,
    });

    expect(result.shouldCreateIncident).toBe(false);
  });

  it("expires restart events outside the observation window", () => {
    const now = Date.now();
    const result = evaluateCrashLoop({
      previousState: {
        lastRestartCount: 2,
        restartEvents: [now - 600_000, now - 500_000],
        lastIncidentAt: 0,
      },
      restartCount: 2,
      status: "online",
      now,
      threshold: 3,
      windowMs: 300_000,
      cooldownMs: 1_800_000,
    });

    expect(result.state.restartEvents).toEqual([]);
    expect(result.shouldCreateIncident).toBe(false);
  });
});

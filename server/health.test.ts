import { describe, expect, it, vi } from "vitest";
import { checkReadiness } from "./health";

describe("health readiness", () => {
  it("reports ready when the database probe succeeds", async () => {
    const probe = vi.fn().mockResolvedValue(undefined);

    await expect(checkReadiness(probe)).resolves.toEqual({
      status: "ready",
      checks: { database: "ok" },
    });
    expect(probe).toHaveBeenCalledOnce();
  });

  it("reports not_ready without exposing the database error", async () => {
    const probe = vi.fn().mockRejectedValue(new Error("sensitive connection details"));

    await expect(checkReadiness(probe)).resolves.toEqual({
      status: "not_ready",
      checks: { database: "unavailable" },
    });
  });
});

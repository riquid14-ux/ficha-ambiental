import { describe, it, expect } from "vitest";

const BASE_URL = "http://localhost:3000";

describe("Autodesk Integration", () => {
  it("should have ADS credentials configured", () => {
    expect(process.env.ADS_CLIENT_ID).toBeTruthy();
    expect(process.env.ADS_CLIENT_SECRET).toBeTruthy();
    expect(process.env.ADS_CLIENT_ID!.length).toBeGreaterThan(10);
    expect(process.env.ADS_CLIENT_SECRET!.length).toBeGreaterThan(10);
  });

  it("should return health status with adsConfigured=true", async () => {
    const response = await fetch(`${BASE_URL}/api/autodesk/health`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.adsConfigured).toBe(true);
    expect(data.service).toBe("Ficha de Controlo Ambiental");
  });

  it("should return status with configured=true", async () => {
    const response = await fetch(`${BASE_URL}/api/autodesk/status`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.configured).toBe(true);
    expect(data.clientId).toContain("...");
  });

  it("should redirect to Autodesk OAuth on /api/autodesk/login", async () => {
    const response = await fetch(`${BASE_URL}/api/autodesk/login`, { redirect: "manual" });
    expect(response.status).toBe(302);
    const location = response.headers.get("location");
    expect(location).toContain("developer.api.autodesk.com");
    expect(location).toContain("authorize");
    expect(location).toContain(process.env.ADS_CLIENT_ID);
  });
});

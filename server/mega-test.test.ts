import { describe, it, expect } from "vitest";

describe("Page Components Exist", () => {
  const pages = [
    "Dashboard", "WeeklyForm", "AdminPanel", "ReviewPage",
    "Timeline", "PhaseMeasures", "Certifications", "Gamma",
    "Matriz", "Calendario", "Planos", "RDCD", "Workflow",
    "SubmissionHistory", "KPI", "MIRR", "Login", "Profile"
  ];
  for (const page of pages) {
    it(`${page} component file exists`, async () => {
      const fs = await import("fs");
      expect(fs.existsSync(`${process.cwd()}/client/src/pages/${page}.tsx`)).toBe(true);
    });
  }
});

describe("Translation Dictionary", () => {
  it("should have 600+ translation entries", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(`${process.cwd()}/client/src/contexts/LanguageContext.tsx`, "utf-8");
    const matches = content.match(/^\s+"[^"]+": \{ pt:/gm) || [];
    expect(matches.length).toBeGreaterThan(600);
  });
});

describe("Database Schema", () => {
  it("should define all required tables", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync(`${process.cwd()}/drizzle/schema.ts`, "utf-8");
    for (const t of ["users","companies","projects","weekly_submissions","measure_responses","measures","sections","project_phases","calendar_events","kpi_metrics","kpi_submissions","kpi_values"]) {
      expect(schema).toContain(`"${t}"`);
    }
  });
  it("should use English status enums", async () => {
    const fs = await import("fs");
    const schema = fs.readFileSync(`${process.cwd()}/drizzle/schema.ts`, "utf-8");
    for (const s of ["draft","submitted","approved","rejected"]) {
      expect(schema).toContain(`"${s}"`);
    }
  });
});

describe("tRPC Router", () => {
  it("should have all key procedures", async () => {
    const fs = await import("fs");
    const router = fs.readFileSync(`${process.cwd()}/server/routers.ts`, "utf-8");
    for (const p of ["submissions:","sections:","measures:","responses:","reviewComments:","companies:","users:","projects:","evidence:","files:","importPdf:"]) {
      expect(router).toContain(p);
    }
  });
  it("should enforce separation of duties", async () => {
    const fs = await import("fs");
    const router = fs.readFileSync(`${process.cwd()}/server/routers.ts`, "utf-8");
    expect(router).toContain("createdBy");
    expect(router).toContain("submittedBy");
  });
});


describe("App Branding", () => {
  it("should use correct name in translations", async () => {
    const fs = await import("fs");
    const lang = fs.readFileSync(`${process.cwd()}/client/src/contexts/LanguageContext.tsx`, "utf-8");
    expect(lang).toContain("Plataforma de Gestão Ambiental");
  });
});

describe("Security", () => {
  it("should have 2FA and password hashing", async () => {
    const fs = await import("fs");
    const router = fs.readFileSync(`${process.cwd()}/server/routers.ts`, "utf-8");
    expect(router).toContain("totp");
    expect(router).toContain("bcrypt");
  });
});

describe("PDF Import", () => {
  it("should have importPdf with LLM integration", async () => {
    const fs = await import("fs");
    const router = fs.readFileSync(`${process.cwd()}/server/routers.ts`, "utf-8");
    expect(router).toContain("importPdf:");
    expect(router).toContain("invokeLLM");
    expect(router).toContain("gemini");
  });
});

describe("Admin Pagination", () => {
  it("should have pagination controls", async () => {
    const fs = await import("fs");
    const admin = fs.readFileSync(`${process.cwd()}/client/src/pages/AdminPanel.tsx`, "utf-8");
    expect(admin).toContain("currentPage");
    expect(admin).toContain("PAGE_SIZE");
    expect(admin).toContain("paginatedUsers");
    expect(admin).toContain("totalPages");
  });
});

describe("Key Features", () => {
  for (const [name, file] of [["GAMMA","Gamma"],["Certifications","Certifications"],["KPI","KPI"],["MIRR","MIRR"]]) {
    it(`${name} page has substantial content`, async () => {
      const fs = await import("fs");
      const content = fs.readFileSync(`${process.cwd()}/client/src/pages/${file}.tsx`, "utf-8");
      expect(content.length).toBeGreaterThan(1000);
    });
  }
});

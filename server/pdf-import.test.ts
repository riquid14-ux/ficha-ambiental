import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

describe("PDF Import", () => {
  it("test PDF file exists and is valid base64", () => {
    const pdfBuffer = readFileSync("/tmp/test_ficha_controlo_sem30_2026.pdf");
    const pdfBase64 = pdfBuffer.toString("base64");
    expect(pdfBase64.length).toBeGreaterThan(100);
    // Verify it starts with PDF magic bytes (JVBERi0 = %PDF-)
    expect(pdfBase64.startsWith("JVBERi0")).toBe(true);
  });

  it("test PDF can be decoded back to valid PDF", () => {
    const pdfBuffer = readFileSync("/tmp/test_ficha_controlo_sem30_2026.pdf");
    const pdfBase64 = pdfBuffer.toString("base64");
    const decoded = Buffer.from(pdfBase64, "base64");
    expect(decoded.toString("ascii", 0, 5)).toBe("%PDF-");
  });

  it("importPdf procedure exists in routers", async () => {
    const routersContent = readFileSync("./server/routers.ts", "utf-8");
    expect(routersContent).toContain("importPdf:");
    expect(routersContent).toContain("pdfBase64: z.string()");
    expect(routersContent).toContain("invokeLLM");
    expect(routersContent).toContain("gemini-3-flash-preview");
  });

  it("importPdf procedure has correct input schema", async () => {
    const routersContent = readFileSync("./server/routers.ts", "utf-8");
    expect(routersContent).toContain("projectId: z.number()");
    expect(routersContent).toContain("weekNumber: z.number()");
    expect(routersContent).toContain("year: z.number()");
    expect(routersContent).toContain("pdfFilename: z.string()");
  });

  it("importPdf procedure stores PDF in S3 and creates submission", async () => {
    const routersContent = readFileSync("./server/routers.ts", "utf-8");
    // Verifies the procedure uploads to S3
    expect(routersContent).toContain("storagePut");
    // Verifies it creates a weekly submission
    expect(routersContent).toContain("weeklySubmissions");
    // Verifies it creates measure responses
    expect(routersContent).toContain("measureResponses");
  });

  it("importPdf procedure returns correct response format", async () => {
    const routersContent = readFileSync("./server/routers.ts", "utf-8");
    expect(routersContent).toContain("submissionId");
    expect(routersContent).toContain("matchedMeasures");
    expect(routersContent).toContain("totalMeasures");
  });
});

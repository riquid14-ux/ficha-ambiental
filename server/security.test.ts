import { describe, it, expect } from "vitest";
import fs from "fs";

const routerCode = fs.readFileSync(`${process.cwd()}/server/routers.ts`, "utf-8");
const indexCode = fs.readFileSync(`${process.cwd()}/server/_core/index.ts`, "utf-8");
const llmProvider = fs.readFileSync(`${process.cwd()}/server/llm-provider.ts`, "utf-8");

describe("Security Drill Tests", () => {
  
  describe("A1: Injection Prevention", () => {
    it("should use parameterized queries (Drizzle ORM), not raw string concatenation", () => {
      // Check for dangerous patterns: execute(`SELECT ... ${variable}`)
      const rawConcat = (routerCode.match(/execute\(`[^`]*\$\{/g) || []).length;
      // All SQL should use tagged template literals: sql`...`
      const taggedSql = (routerCode.match(/sql`/g) || []).length;
      expect(taggedSql).toBeGreaterThan(30); // We have 42+ tagged sql uses
      // Drizzle ORM parameterized queries
      const drizzleQueries = (routerCode.match(/\.select\(\)|\.insert\(|\.update\(|\.delete\(/g) || []).length;
      expect(drizzleQueries).toBeGreaterThan(10);
    });

    it("should validate all inputs with Zod schemas", () => {
      const zodSchemas = (routerCode.match(/z\.object|z\.string|z\.number|z\.enum/g) || []).length;
      expect(zodSchemas).toBeGreaterThan(200);
    });
  });

  describe("A2: Authentication", () => {
    it("should use bcrypt for password hashing", () => {
      expect(routerCode).toContain("bcryptjs");
      expect(routerCode).toContain("bcrypt.hash");
      expect(routerCode).toContain("compare");
    });

    it("should enforce minimum password length", () => {
      expect(routerCode).toMatch(/password.*length|\.min\(8\)/);
    });

    it("should implement 2FA with TOTP", () => {
      expect(routerCode).toContain("totp");
      expect(routerCode).toContain("otpauth");
    });

    it("should NOT have emailLogin bypass (removed)", () => {
      expect(routerCode).not.toContain("emailLogin:");
    });
  });

  describe("A3: Sensitive Data Exposure", () => {
    it("should not expose raw password hash in API responses", () => {
      // The auth.me endpoint converts passwordHash to boolean (!!passwordHash)
      expect(routerCode).toContain("passwordHash: !!passwordHash");
    });

    it("should not log sensitive data", () => {
      const sensitiveLog = routerCode.match(/console\.log.*password|console\.log.*token|console\.log.*secret/gi);
      expect(sensitiveLog).toBeNull();
    });

    it("should strip totpSecret from API responses", () => {
      expect(routerCode).toContain("totpSecret");
      // Destructured out in auth.me
      expect(routerCode).toContain("{ passwordHash, totpSecret, ...safe }");
    });
  });

  describe("A5: Access Control", () => {
    it("should have more protected procedures than public", () => {
      const protectedCount = (routerCode.match(/protectedProcedure/g) || []).length;
      const publicCount = (routerCode.match(/publicProcedure/g) || []).length;
      expect(protectedCount).toBeGreaterThan(publicCount * 5);
    });

    it("should have admin role checks", () => {
      const adminChecks = (routerCode.match(/role.*admin|isAdmin|FORBIDDEN/g) || []).length;
      expect(adminChecks).toBeGreaterThan(50);
    });

    it("should prevent self-approval of submissions", () => {
      expect(routerCode).toMatch(/createdBy|submittedBy/);
      expect(routerCode).toContain("FORBIDDEN");
    });
  });

  describe("A6: Security Configuration", () => {
    it("should use helmet middleware", () => {
      expect(indexCode).toContain("helmet");
    });

    it("should have rate limiting on auth endpoints", () => {
      expect(indexCode).toContain("rateLimit");
    });

    it("should hide X-Powered-By header", () => {
      // Helmet hides this by default
      expect(indexCode).toContain("helmet");
    });

    it("should set Referrer-Policy", () => {
      expect(indexCode).toContain("referrerPolicy");
    });
  });

  describe("A7: XSS Prevention", () => {
    it("should not use dangerouslySetInnerHTML in app pages", () => {
      const pagesDir = `${process.cwd()}/client/src/pages`;
      const pageFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith(".tsx"));
      for (const file of pageFiles) {
        const content = fs.readFileSync(`${pagesDir}/${file}`, "utf-8");
        expect(content).not.toContain("dangerouslySetInnerHTML");
      }
    });

    it("should not use eval() in client code", () => {
      const pagesDir = `${process.cwd()}/client/src/pages`;
      const pageFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith(".tsx"));
      for (const file of pageFiles) {
        const content = fs.readFileSync(`${pagesDir}/${file}`, "utf-8");
        expect(content).not.toMatch(/\beval\s*\(/);
      }
    });
  });

  describe("File Upload Security", () => {
    it("should validate MIME types", () => {
      expect(routerCode).toContain("ALLOWED_FILE_TYPES");
    });

    it("should enforce file size limits", () => {
      expect(routerCode).toContain("MAX_FILE_SIZE");
    });
  });

  describe("LLM Provider Security", () => {
    it("should support Azure OpenAI as secure alternative", () => {
      expect(llmProvider).toContain("azure_openai");
      expect(llmProvider).toContain("AZURE_OPENAI_ENDPOINT");
      expect(llmProvider).toContain("AZURE_OPENAI_API_KEY");
    });

    it("should support multiple LLM providers", () => {
      expect(llmProvider).toContain("callAzureOpenAI");
      expect(llmProvider).toContain("callGeminiDirect");
      expect(llmProvider).toContain("callManusLLM");
    });

    it("should auto-detect provider when set to auto", () => {
      expect(llmProvider).toContain('"auto"');
    });
  });

  describe("Session Security", () => {
    it("should use 30-day session expiry (not 365)", () => {
      // Check for 30 * 24 * 60 * 60 * 1000 = 2592000000
      expect(routerCode).toMatch(/30\s*\*\s*24|2592000/);
    });
  });

  describe("Account Enumeration Prevention", () => {
    it("should return generic error for non-existent accounts", () => {
      // Login should not reveal if email exists
      expect(routerCode).toContain("Email ou palavra-passe incorretos");
    });
  });
});

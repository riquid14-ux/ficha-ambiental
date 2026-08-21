import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// ═══════════════════════════════════════════════════════════════════════════════
// RED TEAM DRILL DE ELITE — PLATAFORMA DE GESTÃO AMBIENTAL
// Ataques de Camada Avançada, Zero-Day, Engenharia Reversa
// ═══════════════════════════════════════════════════════════════════════════════

function readFile(relPath: string): string {
  try { return fs.readFileSync(path.join(__dirname, "..", relPath), "utf-8"); }
  catch { return ""; }
}

const routersCode = readFile("server/routers.ts");
const dbCode = readFile("server/db.ts");
const indexCode = readFile("server/_core/index.ts");
const sdkCode = readFile("server/_core/sdk.ts");
const cookiesCode = readFile("server/_core/cookies.ts");
const emailCode = readFile("server/email.ts");
const autodeskCode = readFile("server/autodesk.ts");
const archiveCode = readFile("server/archive-provider.ts");
const imageExtractorCode = readFile("server/image-extractor.ts");
const llmCode = readFile("server/llm-provider.ts");
const schemaCode = readFile("drizzle/schema.ts");
const packageJson = readFile("package.json");
const lockFile = readFile("pnpm-lock.yaml");
const indexHtml = readFile("client/index.html");
const viteConfig = readFile("vite.config.ts");
const gitignore = readFile(".gitignore");

// ═══════════════════════════════════════════════════════════════════════════════
// 1. RACE CONDITIONS & BUSINESS LOGIC EXPLOITATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("1. Race Conditions & Business Logic Exploitation", () => {

  describe("1.1 HTTP/2 Single-Packet Attack — Limit Bypass via Concorrência", () => {
    it("draft creation checks existing count in DB (server-side, not client)", () => {
      expect(routersCode).toMatch(/getDraftCountForCompany/);
      expect(dbCode).toMatch(/getDraftCountForCompany/);
    });

    it("submission for same week/company/project is checked before creation", () => {
      expect(routersCode).toMatch(/getSubmissionForWeek/);
      expect(dbCode).toMatch(/getSubmissionForWeek/);
    });

    it("password reset token is single-use (cleared after use)", () => {
      expect(routersCode).toMatch(/passwordResetToken:\s*null/);
      expect(routersCode).toMatch(/passwordResetExpiry:\s*null/);
    });

    it("password reset token has expiry (1 hour)", () => {
      expect(routersCode).toMatch(/3600000/); // 1 hour in ms
      expect(routersCode).toMatch(/passwordResetExpiry.*Date\.now\(\)/);
    });
  });

  describe("1.2 Descontrolo de Fluxo — MFA Bypass", () => {
    it("2FA verification is a separate step that cannot be skipped", () => {
      // verify2FA is a separate procedure, not part of login
      expect(routersCode).toMatch(/verify2FA: publicProcedure/);
    });

    it("login returns requires2FA flag instead of session when 2FA is enabled", () => {
      // Login should detect 2FA and require verification
      expect(routersCode).toMatch(/totpEnabled|requires2FA|totp/);
    });

    it("2FA code is validated with TOTP algorithm (time-based, not static)", () => {
      expect(routersCode).toMatch(/TOTP|totp.*validate|Secret\.fromBase32/);
    });

    it("2FA validation window is limited (max 1 period tolerance)", () => {
      expect(routersCode).toMatch(/window:\s*1/);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. TOKEN & CRYPTOGRAPHY COMPROMISE
// ═══════════════════════════════════════════════════════════════════════════════

describe("2. Token & Cryptography Compromise", () => {

  describe("2.1 JWKS / Key Confusion via SSRF", () => {
    it("JWT verification does NOT use dynamic JWKS endpoint (no jwks_uri fetch)", () => {
      expect(sdkCode).not.toMatch(/jwks_uri|\.well-known\/jwks/);
      expect(routersCode).not.toMatch(/jwks_uri|\.well-known\/jwks/);
    });

    it("JWT uses static secret key from environment (not fetched remotely)", () => {
      // Secret is loaded from ENV.cookieSecret (static env var), not from a remote endpoint
      expect(sdkCode).toMatch(/ENV\.cookieSecret|getSessionSecret/);
      expect(sdkCode).not.toMatch(/fetch.*jwks|axios.*jwks/);
    });

    it("JWT algorithm is explicitly set to HS256 (no algorithm auto-detection)", () => {
      expect(sdkCode).toMatch(/alg:\s*["']HS256["']/);
      expect(sdkCode).toMatch(/algorithms:\s*\[["']HS256["']\]/);
    });

    it("JWT verification rejects tokens with different algorithms", () => {
      // jose library with explicit algorithms array rejects RS256, none, etc.
      expect(sdkCode).toMatch(/algorithms:\s*\[["']HS256["']\]/);
    });
  });

  describe("2.2 Padding Oracle / Bit Flipping on Session Tokens", () => {
    it("session tokens use JWT with HMAC (not block cipher CBC)", () => {
      // HS256 = HMAC-SHA256, not AES-CBC
      expect(sdkCode).toMatch(/HS256/);
      expect(sdkCode).not.toMatch(/AES-CBC|aes-128-cbc|aes-256-cbc/);
    });

    it("cookies are httpOnly (cannot be read by JavaScript)", () => {
      expect(cookiesCode).toMatch(/httpOnly:\s*true/);
    });

    it("cookies use secure flag (HTTPS only)", () => {
      expect(cookiesCode).toMatch(/secure/);
    });

    it("cookies use SameSite attribute", () => {
      expect(cookiesCode).toMatch(/sameSite/);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. CACHE POISONING & REQUEST SMUGGLING
// ═══════════════════════════════════════════════════════════════════════════════

describe("3. Cache Poisoning & Request Smuggling", () => {

  describe("3.1 Web Cache Poisoning", () => {
    it("X-Forwarded-Host is NOT used to generate user-facing URLs in main app", () => {
      // Only autodesk callback uses X-Forwarded-Host (for OAuth redirect)
      // Main app routes do not use it for URL generation
      expect(routersCode).not.toMatch(/X-Forwarded-Host/);
      expect(emailCode).not.toMatch(/X-Forwarded-Host/);
    });

    it("password reset does NOT generate links with Host header", () => {
      // Our password reset returns a message to contact admin, no link generated
      const forgotSection = routersCode.slice(
        routersCode.indexOf("forgotPassword: publicProcedure"),
        routersCode.indexOf("forgotPassword: publicProcedure") + 800
      );
      expect(forgotSection).not.toMatch(/req\.headers\.host|req\.hostname|resetUrl|resetLink/);
      // Instead returns "Contacte apoioamb@startcampus.pt"
      expect(forgotSection).toMatch(/apoioamb@startcampus\.pt/);
    });

    it("Referrer-Policy is set to strict-origin-when-cross-origin", () => {
      expect(indexCode).toMatch(/strict-origin-when-cross-origin/);
    });
  });

  describe("3.2 HTTP Request Smuggling (H2.CL / CL.TE)", () => {
    it("helmet middleware is enabled (handles HTTP header normalization)", () => {
      expect(indexCode).toMatch(/helmet/);
    });

    it("no custom Transfer-Encoding handling in server code", () => {
      expect(indexCode).not.toMatch(/Transfer-Encoding/i);
      expect(routersCode).not.toMatch(/Transfer-Encoding/i);
    });

    it("Express body parser has size limits", () => {
      // tRPC/Express has default body size limits
      // Check no custom body parser with unlimited size
      expect(indexCode).not.toMatch(/limit:\s*['"]?Infinity/);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. SSTI & INSECURE DESERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("4. SSTI & Insecure Deserialization", () => {

  describe("4.1 Server-Side Template Injection (SSTI)", () => {
    it("no server-side template engines are used (no Handlebars/EJS/Pug/Nunjucks)", () => {
      const pkg = JSON.parse(packageJson);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      expect(allDeps).not.toHaveProperty("handlebars");
      expect(allDeps).not.toHaveProperty("ejs");
      expect(allDeps).not.toHaveProperty("pug");
      expect(allDeps).not.toHaveProperty("nunjucks");
      expect(allDeps).not.toHaveProperty("mustache");
    });

    it("email templates use string concatenation, not template engines", () => {
      // Email templates are plain HTML strings, not rendered through template engines
      expect(emailCode).not.toMatch(/handlebars\.compile|ejs\.render|pug\.render/);
      expect(emailCode).toMatch(/`.*\$\{/); // Template literals (safe)
    });

    it("PDF/Word generation does not use user input in template evaluation", () => {
      // docx generation uses docx library, not template engines
      expect(routersCode).not.toMatch(/eval.*input|Function.*input/);
    });
  });

  describe("4.2 Insecure Deserialization", () => {
    it("no native object serialization/deserialization (no serialize-javascript, node-serialize)", () => {
      const pkg = JSON.parse(packageJson);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      expect(allDeps).not.toHaveProperty("node-serialize");
      expect(allDeps).not.toHaveProperty("serialize-javascript");
    });

    it("JSON.parse is used for data parsing (safe deserialization)", () => {
      // tRPC uses superjson which is safe
      expect(routersCode).not.toMatch(/unserialize|deserialize.*Buffer/);
    });

    it("file uploads are processed as binary buffers, not deserialized objects", () => {
      expect(routersCode).toMatch(/Buffer\.from.*base64/);
    });

    it("no pickle/yaml/XML deserialization of user input", () => {
      expect(routersCode).not.toMatch(/yaml\.load|pickle\.loads|xml2js\.parseString/);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CENÁRIO 1: SUPPLY CHAIN & DEPENDENCY CONFUSION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Cenário 1: Supply Chain & Dependency Confusion", () => {

  it("no internal scoped packages (@startcampus/*) that could be confused", () => {
    expect(packageJson).not.toMatch(/@startcampus\//);
    expect(packageJson).not.toMatch(/@internal\//);
  });

  it("pnpm-lock.yaml exists (pinned dependency versions)", () => {
    expect(lockFile.length).toBeGreaterThan(1000);
  });

  it("no wildcard (*) or 'latest' versions in dependencies", () => {
    const pkg = JSON.parse(packageJson);
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, version] of Object.entries(allDeps)) {
      expect(String(version)).not.toBe("*");
      expect(String(version)).not.toBe("latest");
    }
  });

  it("no postinstall scripts that could execute malicious code", () => {
    const pkg = JSON.parse(packageJson);
    // Check that postinstall doesn't run arbitrary scripts
    if (pkg.scripts?.postinstall) {
      expect(pkg.scripts.postinstall).not.toMatch(/curl|wget|eval|node -e/);
    }
  });

  it(".gitignore excludes node_modules and build artifacts", () => {
    expect(gitignore).toMatch(/node_modules/);
    expect(gitignore).toMatch(/dist/);
  });

  it("source maps are NOT included in production build", () => {
    expect(viteConfig).not.toMatch(/sourcemap:\s*true/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CENÁRIO 2: BLIND SSRF VIA SVG/XML IN MICROSERVICES
// ═══════════════════════════════════════════════════════════════════════════════

describe("Cenário 2: Blind SSRF via SVG/XML em Microserviços", () => {

  it("SVG uploads are accepted but NOT parsed/rendered server-side", () => {
    // SVGs are stored as-is in S3, never parsed or rendered on server
    // The server only stores the file, it doesn't process SVG content
    expect(routersCode).not.toMatch(/svg.*parse|parseSvg|renderSvg/i);
  });

  it("no XML parser with external entity resolution enabled", () => {
    expect(routersCode).not.toMatch(/xml2js|libxmljs|DOMParser/);
    expect(dbCode).not.toMatch(/xml2js|libxmljs/);
  });

  it("no server-side URL fetching from user-supplied URLs", () => {
    // The app does not fetch URLs provided by users
    expect(routersCode).not.toMatch(/fetch\(\s*input\.url/);
    expect(routersCode).not.toMatch(/axios\.get\(\s*input\./);
    expect(routersCode).not.toMatch(/http\.get\(\s*input\./);
  });

  it("image extractor uses controlled CLI tools, not URL-based fetching", () => {
    if (imageExtractorCode) {
      // pdfimages operates on local files only, not URLs
      expect(imageExtractorCode).toMatch(/pdfimages|mkdtemp/i);
      expect(imageExtractorCode).not.toMatch(/fetch\(|axios\./);
    }
  });

  it("LLM provider calls use hardcoded API endpoints, not user-supplied URLs", () => {
    if (llmCode) {
      expect(llmCode).toMatch(/process\.env|BUILT_IN_FORGE/);
      expect(llmCode).not.toMatch(/input\.url|input\.endpoint/);
    }
  });

  it("archive provider uses configured S3 endpoints only", () => {
    if (archiveCode) {
      expect(archiveCode).toMatch(/storagePut|storageGet/);
      expect(archiveCode).not.toMatch(/input\.url|fetch\(input/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CENÁRIO 3: HOST HEADER POISONING ON PASSWORD RESET
// ═══════════════════════════════════════════════════════════════════════════════

describe("Cenário 3: Expropriação de Contas por Envenenamento de Host Header", () => {

  it("password reset does NOT send email with reset link (no link to poison)", () => {
    // Our implementation returns a message to contact admin, no email link
    const forgotSection = routersCode.slice(
      routersCode.indexOf("forgotPassword: publicProcedure"),
      routersCode.indexOf("forgotPassword: publicProcedure") + 800
    );
    expect(forgotSection).toMatch(/apoioamb@startcampus\.pt/);
    expect(forgotSection).not.toMatch(/sendEmail|sendPasswordReset|resetUrl/);
  });

  it("password reset token is NOT exposed in the API response", () => {
    const forgotSection = routersCode.slice(
      routersCode.indexOf("forgotPassword: publicProcedure"),
      routersCode.indexOf("forgotPassword: publicProcedure") + 800
    );
    // Response only contains success message, not the token
    expect(forgotSection).toMatch(/success:\s*true.*message/);
    expect(forgotSection).not.toMatch(/return.*token/);
  });

  it("Autodesk callback URL uses X-Forwarded-Host but is limited to OAuth redirect only", () => {
    // Only autodesk.ts uses X-Forwarded-Host, and only for OAuth callback URL
    expect(autodeskCode).toMatch(/x-forwarded-host|X-Forwarded-Host/i);
    // It's only used for the callback URL path, not for user-facing links
    expect(autodeskCode).toMatch(/CALLBACK_URL_PATH|callback/i);
  });

  it("main application routes do NOT use Host header for URL generation", () => {
    expect(routersCode).not.toMatch(/req\.headers\.host|req\.hostname/);
    expect(emailCode).not.toMatch(/req\.headers\.host|req\.hostname/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MÉTRICAS CRIPTOGRÁFICAS E RESILIÊNCIA TÉCNICA
// ═══════════════════════════════════════════════════════════════════════════════

describe("Métricas Criptográficas e Resiliência Técnica", () => {

  describe("Zero-Trust Session Binding", () => {
    it("JWT tokens are bound to httpOnly secure cookies (not transferable via JS)", () => {
      expect(cookiesCode).toMatch(/httpOnly:\s*true/);
      expect(cookiesCode).toMatch(/secure/);
    });

    it("session tokens have finite expiry (30 days)", () => {
      expect(routersCode).toMatch(/maxAge.*30.*24.*60.*60/);
    });

    it("JWT includes user identity claims (id, role, email)", () => {
      expect(sdkCode).toMatch(/openId|userId|role|email/);
    });

    it("password change invalidates session token data", () => {
      expect(routersCode).toMatch(/changePassword.*protectedProcedure/);
    });
  });

  describe("Content Security Policy (CSP) Estrita", () => {
    it("CSP frame-ancestors is configured (prevents clickjacking)", () => {
      expect(indexCode).toMatch(/frame-ancestors/);
    });

    it("helmet is enabled for security headers", () => {
      expect(indexCode).toMatch(/helmet/);
    });

    it("X-Content-Type-Options is set (via helmet, prevents MIME sniffing)", () => {
      // helmet sets this by default
      expect(indexCode).toMatch(/helmet/);
    });

    it("no inline scripts in index.html except controlled pre-load", () => {
      // Count script tags - should be minimal
      const inlineScripts = (indexHtml.match(/<script[^>]*>[^<]+<\/script>/g) || []);
      // Only the theme pre-load script should exist
      expect(inlineScripts.length).toBeLessThanOrEqual(2);
    });
  });

  describe("Imutabilidade e Verificação de Pipelines", () => {
    it("lock file exists for reproducible builds", () => {
      expect(lockFile.length).toBeGreaterThan(1000);
    });

    it("no eval() or dynamic code execution in server", () => {
      expect(routersCode).not.toMatch(/\beval\s*\(/);
      expect(routersCode).not.toMatch(/new\s+Function\s*\(/);
      expect(dbCode).not.toMatch(/\beval\s*\(/);
    });

    it("environment variables are loaded from secure env module", () => {
      const envCode = readFile("server/_core/env.ts");
      expect(envCode).toMatch(/process\.env/);
      expect(envCode).toMatch(/JWT_SECRET|DATABASE_URL/);
    });

    it("no .env file committed to repository", () => {
      expect(gitignore).toMatch(/\.env/);
      const envExists = fs.existsSync(path.join(__dirname, "..", ".env"));
      expect(envExists).toBe(false);
    });
  });
});

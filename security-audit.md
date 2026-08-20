# Security Audit Report — Plataforma de Gestão Ambiental
**Date:** 20 August 2026  
**Auditor:** Internal Security Review  

## Executive Summary
The application uses a solid security foundation (bcrypt password hashing, parameterized SQL via Drizzle ORM, httpOnly cookies, Zod input validation, role-based access control). However, several vulnerabilities were identified that should be addressed before production deployment.

## CRITICAL Vulnerabilities

### 1. emailLogin procedure — Authentication Bypass (CRITICAL)
**File:** `server/routers.ts` line ~380  
**Issue:** The `emailLogin` procedure is a `publicProcedure` that creates a session token with ONLY an email address — no password, no 2FA verification. Anyone who knows a valid email can log in.  
**Fix:** REMOVE this procedure entirely. Login should only go through the `login` procedure (email + password + 2FA).

### 2. No Rate Limiting on Login (HIGH)
**Issue:** No rate limiting on login, register, forgotPassword, or verify2FA endpoints. Allows brute-force attacks on passwords and 2FA codes.  
**Fix:** Add express-rate-limit middleware to auth endpoints (max 5 attempts per 15 minutes per IP).

### 3. appSettings publicly readable (MEDIUM)
**File:** `server/routers.ts` lines 105-122  
**Issue:** `appSettings.get` and `appSettings.getAll` are `publicProcedure` — anyone can read all app settings without authentication, which may include SMTP credentials or other sensitive config.  
**Fix:** Change to `protectedProcedure`.

## HIGH Vulnerabilities

### 4. No File Type Validation on Upload (HIGH)
**Issue:** File uploads accept any mimeType without validation. An attacker could upload executable files, HTML files (stored XSS), or other dangerous content.  
**Fix:** Whitelist allowed MIME types (image/jpeg, image/png, application/pdf, etc.).

### 5. No File Size Limit on Upload (HIGH)
**Issue:** Base64-encoded file data has no size limit in Zod schema. An attacker could send a multi-GB payload causing memory exhaustion.  
**Fix:** Add `.max()` to the base64 string input (e.g., max 10MB = ~13.3M base64 chars).

### 6. Password Policy Inconsistency (MEDIUM)
**Issue:** Login accepts `min(1)`, register requires `min(8)`, changePassword requires `min(6)`. The reset password also uses `min(6)`. Should be consistent at `min(8)`.  
**Fix:** Standardize all password inputs to `min(8)` and add complexity requirements.

### 7. Session Cookie MaxAge Too Long (MEDIUM)
**Issue:** Session cookies have `maxAge: 365 * 24 * 60 * 60 * 1000` (1 year). If a session is compromised, it remains valid for a full year.  
**Fix:** Reduce to 30 days and implement session rotation.

## MEDIUM Vulnerabilities

### 8. No Security Headers (MEDIUM)
**Issue:** No helmet middleware, no Content-Security-Policy, no X-Frame-Options, no HSTS headers.  
**Fix:** Add helmet middleware to Express.

### 9. Account Enumeration via Register (LOW-MEDIUM)
**Issue:** Register returns "Este email já está registado" which confirms email existence. However, login uses generic "Email ou palavra-passe incorretos" which is good.  
**Fix:** Change register to return generic message regardless.

### 10. Password Reset Token Not Hashed (LOW-MEDIUM)
**Issue:** Password reset tokens are stored in plaintext in the database. If DB is compromised, tokens can be used.  
**Fix:** Hash the token before storing, compare hashes on verification.

## LOW Vulnerabilities

### 11. dangerouslySetInnerHTML in Chart Component (LOW)
**Issue:** Used in chart.tsx (shadcn/ui component) for CSS injection. Low risk as it's only used for chart styling, not user content.

### 12. String Inputs Without Max Length (LOW)
**Issue:** 86 `z.string()` inputs without `.max()` limits. Could allow very long strings causing DB issues.  
**Fix:** Add reasonable `.max()` limits to all string inputs.

## What's Already Good ✅

1. **Password Hashing:** bcrypt with 10 rounds (industry standard)
2. **SQL Injection:** ALL SQL uses Drizzle ORM parameterized queries via `sql` template tag — ZERO raw string concatenation
3. **XSS:** React auto-escapes all JSX output. Only 1 dangerouslySetInnerHTML in a UI library component (not user content)
4. **Authentication:** Proper email+password+2FA flow with TOTP (otpauth library)
5. **Authorization:** 99 protectedProcedures + 20 adminProcedures + 128 role checks. Strong separation of duties
6. **Cookie Security:** httpOnly=true, secure=true (on HTTPS), sameSite=none
7. **Sensitive Data:** Password hash is NOT returned to client (line 154 returns `!!passwordHash` boolean, not the hash itself)
8. **Input Validation:** Zod schemas on ALL tRPC procedures — no unvalidated input reaches the server
9. **2FA:** TOTP with SHA1, 6 digits, 30s period, window=1 (industry standard)
10. **CSRF:** tRPC uses POST for mutations, cookies are httpOnly — standard CSRF protection

## Severity Summary

| Severity | Count | Items |
|----------|-------|-------|
| CRITICAL | 1 | emailLogin bypass |
| HIGH | 3 | No rate limiting, no file type validation, no file size limit |
| MEDIUM | 4 | Public appSettings, password policy, session duration, no security headers |
| LOW | 2 | Chart innerHTML, string length limits |

## Recommended Priority

1. **Immediate:** Remove emailLogin procedure
2. **Before production:** Add rate limiting, file validation, security headers
3. **Soon:** Standardize password policy, reduce session duration
4. **Nice to have:** Hash reset tokens, add string max lengths

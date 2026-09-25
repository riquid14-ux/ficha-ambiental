import { Express, Request, Response } from "express";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME, THIRTY_DAYS_MS } from "@shared/const";
import * as db from "./db";
import crypto from "node:crypto";

const ADS_AUTH_URL = "https://developer.api.autodesk.com/authentication/v2";
const ADS_USERINFO_URL = "https://api.aps.autodesk.com/userinfo";
const ADS_CALLBACK_URL_PATH = "/api/autodesk/callback";
const ADS_STATE_COOKIE = "__Host-autodesk_oauth_state";

function getCallbackUrl(req: Request): string {
  if (ENV.adsRedirectUri) return ENV.adsRedirectUri;
  // Não aceitar Host/X-Forwarded-Host arbitrário no redirect_uri. O fallback
  // é apenas para desenvolvimento local e deve ser substituído por
  // ADS_REDIRECT_URI no servidor Start Campus.
  if (!ENV.isProduction && (req.hostname === "localhost" || req.hostname === "127.0.0.1")) {
    return `http://${req.headers.host || "localhost:3000"}${ADS_CALLBACK_URL_PATH}`;
  }
  return `https://ambientfich.co${ADS_CALLBACK_URL_PATH}`;
}

export function registerAutodeskRoutes(app: Express) {
  // ─── Autodesk OAuth: Initiate login ───
  app.get("/api/autodesk/login", (req: Request, res: Response) => {
    if (!ENV.adsClientId) {
      return res.status(503).json({ error: "A integração Autodesk não está disponível." });
    }

    const callbackUrl = getCallbackUrl(req);
    const scopes = "data:read data:write account:read openid";
    const state = crypto.randomBytes(32).toString("base64url");
    res.cookie(ADS_STATE_COOKIE, state, { ...getSessionCookieOptions(req), maxAge: 10 * 60 * 1000 });
    const authUrl = `${ADS_AUTH_URL}/authorize?response_type=code&client_id=${ENV.adsClientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scopes)}&state=${encodeURIComponent(state)}`;

    res.redirect(authUrl);
  });

  // ─── Autodesk OAuth: Callback ───
  app.get("/api/autodesk/callback", async (req: Request, res: Response) => {
    const { code, state } = req.query;
    const expectedState = req.cookies?.[ADS_STATE_COOKIE];
    res.clearCookie(ADS_STATE_COOKIE, getSessionCookieOptions(req));
    const stateMatches = typeof state === "string"
      && typeof expectedState === "string"
      && Buffer.byteLength(state) === Buffer.byteLength(expectedState)
      && crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState));
    if (!code || !stateMatches) {
      return res.status(403).json({ error: "Não foi possível validar a autenticação Autodesk." });
    }

    try {
      const callbackUrl = getCallbackUrl(req);
      const tokenResponse = await fetch(`${ADS_AUTH_URL}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          client_id: ENV.adsClientId,
          client_secret: ENV.adsClientSecret,
          redirect_uri: callbackUrl,
        }),
      });

      if (!tokenResponse.ok) {
        const err = await tokenResponse.text();
        console.error("[Autodesk] Token exchange failed:", err);
        return res.status(400).json({ error: "Não foi possível concluir a autenticação Autodesk." });
      }

      const tokenData = await tokenResponse.json() as any;

      // Store token in session cookie for subsequent API calls
      res.cookie("ads_token", tokenData.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "none", // Required for iframe embedding
        maxAge: tokenData.expires_in * 1000,
      });

      if (tokenData.refresh_token) {
        res.cookie("ads_refresh", tokenData.refresh_token, {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days
        });
      }

      // ─── Auto-login: fetch user email from Autodesk and create app session ───
      try {
        const userInfoRes = await fetch(ADS_USERINFO_URL, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json() as any;
          const email = (userInfo.email || "").toLowerCase().trim();

          if (email) {
            // Try to authenticate the user in our system
            const loginResult = await autodeskEmailLogin(email, userInfo.name || email.split("@")[0], req, res);
            if (loginResult.success) {
              return res.redirect("/dashboard");
            }
            // If login failed (not invited), redirect to login page with error
            return res.redirect("/login?error=no_access&email=" + encodeURIComponent(email));
          }
        }
      } catch (e) {
        console.error("[Autodesk] Failed to fetch user info for auto-login:", e);
      }

      // Fallback: redirect to dashboard (user will need to login manually)
      res.redirect("/dashboard");
    } catch (error: any) {
      console.error("[Autodesk] OAuth callback error:", error);
      return res.status(500).json({ error: "Não foi possível concluir a autenticação Autodesk." });
    }
  });

  // ─── Autodesk Auto-Login: use existing ads_token to authenticate ───
  app.post("/api/autodesk/auto-login", async (req: Request, res: Response) => {
    const token = req.cookies?.ads_token;
    if (!token) {
      return res.status(401).json({ error: "Não existe uma sessão Autodesk válida." });
    }

    try {
      // Fetch user info from Autodesk using the stored token
      const userInfoRes = await fetch(ADS_USERINFO_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userInfoRes.ok) {
        return res.status(401).json({ error: "A sessão Autodesk expirou ou é inválida." });
      }

      const userInfo = await userInfoRes.json() as any;
      const email = (userInfo.email || "").toLowerCase().trim();

      if (!email) {
        return res.status(400).json({ error: "Não foi possível obter o email Autodesk." });
      }

      const loginResult = await autodeskEmailLogin(email, userInfo.name || email.split("@")[0], req, res);

      if (loginResult.success) {
        return res.json({ success: true, email, name: userInfo.name });
      } else {
        return res.status(403).json({
          error: "Não tem acesso. Contacte apoioamb@startcampus.pt",
          email,
        });
      }
    } catch (error: any) {
      console.error("[Autodesk] Auto-login error:", error);
      return res.status(500).json({ error: "Não foi possível validar a sessão Autodesk." });
    }
  });

  // ─── Autodesk Token Status ───
  app.get("/api/autodesk/status", (req: Request, res: Response) => {
    const token = req.cookies?.ads_token;
    res.json({
      connected: !!token,
      configured: !!(ENV.adsClientId && ENV.adsClientSecret),
    });
  });

  // ─── Autodesk: Get user profile (test connectivity) ───
  app.get("/api/autodesk/me", async (req: Request, res: Response) => {
    const token = req.cookies?.ads_token;
    if (!token) {
      return res.status(401).json({ error: "Not authenticated with Autodesk" });
    }

    try {
      const response = await fetch("https://developer.api.autodesk.com/userprofile/v1/users/@me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to get Autodesk profile" });
      }

      const profile = await response.json();
      res.json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── ACC: List hubs ───
  app.get("/api/autodesk/hubs", async (req: Request, res: Response) => {
    const token = req.cookies?.ads_token;
    if (!token) {
      return res.status(401).json({ error: "Not authenticated with Autodesk" });
    }

    try {
      const response = await fetch("https://developer.api.autodesk.com/project/v1/hubs", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to list hubs" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── ACC: List projects in a hub ───
  app.get("/api/autodesk/hubs/:hubId/projects", async (req: Request, res: Response) => {
    const token = req.cookies?.ads_token;
    if (!token) {
      return res.status(401).json({ error: "Not authenticated with Autodesk" });
    }

    try {
      const response = await fetch(`https://developer.api.autodesk.com/project/v1/hubs/${req.params.hubId}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to list projects" });
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Health check for ACC iframe ───
  app.get("/api/autodesk/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "Ficha de Controlo Ambiental",
      version: "1.0",
      adsConfigured: !!(ENV.adsClientId && ENV.adsClientSecret),
    });
  });
}

/**
 * Helper: authenticate a user by email (from Autodesk profile).
 * Creates user from invitation if needed, or logs in existing user.
 * Returns { success: true } if login succeeded, { success: false } otherwise.
 */
async function autodeskEmailLogin(
  email: string,
  name: string,
  req: Request,
  res: Response
): Promise<{ success: boolean }> {
  // 1. Check if user already exists
  const existingUsers = await db.getAllUsers();
  const existingUser = existingUsers.find(
    (u) => u.email?.toLowerCase().trim() === email
  );

  if (existingUser) {
    if (existingUser.accountStatus !== "active" || Boolean(existingUser.totpEnabled)) return { success: false };
    const sessionToken = await sdk.createSessionToken(existingUser.openId, {
      name: existingUser.name || name,
      expiresInMs: THIRTY_DAYS_MS,
    });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, {
      ...cookieOptions,
      maxAge: THIRTY_DAYS_MS,
    });
    return { success: true };
  }

  // 2. Check for pending invitation
  const invitation = await db.getPendingInvitationByEmail(email);

  if (invitation) {
    const openId = `email_${email.replace(/[^a-z0-9]/g, "_")}`;
    await db.upsertUser({
      openId,
      name,
      email,
      loginMethod: "autodesk",
      role: invitation.role as any,
    });

    const newUser = await db.getUserByOpenId(openId);
    if (newUser && invitation.companyId) {
      await db.updateUserCompany(newUser.id, invitation.companyId);
    }
    await db.acceptInvitation(invitation.id);

    const sessionToken = await sdk.createSessionToken(openId, { name, expiresInMs: THIRTY_DAYS_MS });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, {
      ...cookieOptions,
      maxAge: THIRTY_DAYS_MS,
    });
    return { success: true };
  }

  // 3. Administradores são criados e promovidos apenas pela Administração.
  return { success: false };
}

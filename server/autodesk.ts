import { Express, Request, Response } from "express";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME } from "@shared/const";
import * as db from "./db";

const ADS_AUTH_URL = "https://developer.api.autodesk.com/authentication/v2";
const ADS_USERINFO_URL = "https://api.aps.autodesk.com/userinfo";
const ADS_CALLBACK_URL_PATH = "/api/autodesk/callback";

function getCallbackUrl(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "ambientfich-7cdehgqy.manus.space";
  return `${protocol}://${host}${ADS_CALLBACK_URL_PATH}`;
}

export function registerAutodeskRoutes(app: Express) {
  // ─── Autodesk OAuth: Initiate login ───
  app.get("/api/autodesk/login", (req: Request, res: Response) => {
    if (!ENV.adsClientId) {
      return res.status(500).json({ error: "Autodesk credentials not configured" });
    }

    const callbackUrl = getCallbackUrl(req);
    const scopes = "data:read data:write account:read openid";
    const authUrl = `${ADS_AUTH_URL}/authorize?response_type=code&client_id=${ENV.adsClientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scopes)}`;

    res.redirect(authUrl);
  });

  // ─── Autodesk OAuth: Callback ───
  app.get("/api/autodesk/callback", async (req: Request, res: Response) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: "Authorization code missing" });
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
        return res.status(400).json({ error: "Failed to exchange token", details: err });
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
      return res.status(500).json({ error: "OAuth callback failed", details: error.message });
    }
  });

  // ─── Autodesk Auto-Login: use existing ads_token to authenticate ───
  app.post("/api/autodesk/auto-login", async (req: Request, res: Response) => {
    const token = req.cookies?.ads_token;
    if (!token) {
      return res.status(401).json({ error: "No Autodesk token found. Please authenticate with Autodesk first." });
    }

    try {
      // Fetch user info from Autodesk using the stored token
      const userInfoRes = await fetch(ADS_USERINFO_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!userInfoRes.ok) {
        return res.status(401).json({ error: "Autodesk token expired or invalid. Please re-authenticate." });
      }

      const userInfo = await userInfoRes.json() as any;
      const email = (userInfo.email || "").toLowerCase().trim();

      if (!email) {
        return res.status(400).json({ error: "Could not retrieve email from Autodesk profile." });
      }

      const loginResult = await autodeskEmailLogin(email, userInfo.name || email.split("@")[0], req, res);

      if (loginResult.success) {
        return res.json({ success: true, email, name: userInfo.name });
      } else {
        return res.status(403).json({
          error: "Não tem acesso. Contacte Nairana Aguiar npa@startcampus.pt",
          email,
        });
      }
    } catch (error: any) {
      console.error("[Autodesk] Auto-login error:", error);
      return res.status(500).json({ error: "Auto-login failed", details: error.message });
    }
  });

  // ─── Autodesk Token Status ───
  app.get("/api/autodesk/status", (req: Request, res: Response) => {
    const token = req.cookies?.ads_token;
    res.json({
      connected: !!token,
      clientId: ENV.adsClientId ? ENV.adsClientId.substring(0, 8) + "..." : null,
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
    const sessionToken = await sdk.createSessionToken(existingUser.openId, {
      name: existingUser.name || name,
    });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, {
      ...cookieOptions,
      maxAge: 365 * 24 * 60 * 60 * 1000,
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

    const sessionToken = await sdk.createSessionToken(openId, { name });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, {
      ...cookieOptions,
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
    return { success: true };
  }

  // 3. Check if it's one of the auto-admin emails
  const autoAdminEmails = ["rmd@startcampus.pt", "rom@startcampus.pt", "npa@startcampus.pt"];
  if (autoAdminEmails.includes(email)) {
    const openId = `email_${email.replace(/[^a-z0-9]/g, "_")}`;
    await db.upsertUser({
      openId,
      name,
      email,
      loginMethod: "autodesk",
      role: "admin",
    });

    const sessionToken = await sdk.createSessionToken(openId, { name });
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, {
      ...cookieOptions,
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });
    return { success: true };
  }

  // 4. No access
  return { success: false };
}

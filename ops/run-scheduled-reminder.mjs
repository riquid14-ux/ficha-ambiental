import fs from "node:fs";

const [kind] = process.argv.slice(2);
if (!new Set(["weekly", "deadline"]).has(kind)) {
  throw new Error("Uso: node ops/run-scheduled-reminder.mjs weekly|deadline");
}

const baseUrl = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
const token = process.env.SCHEDULER_TOKEN || "";
if (!/^https:\/\//.test(baseUrl)) throw new Error("APP_BASE_URL deve ser um URL HTTPS.");
if (token.length < 32) throw new Error("SCHEDULER_TOKEN deve ter pelo menos 32 caracteres.");

const endpoint = `${baseUrl}/api/scheduled/${kind}-reminder`;
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "stand-systemd-scheduler/1.0",
  },
  body: "{}",
  signal: AbortSignal.timeout(30_000),
});
const body = await response.text();
if (!response.ok) throw new Error(`Agendamento ${kind} falhou (${response.status}): ${body.slice(0, 500)}`);
console.log(`[scheduler] ${kind}: ${body.slice(0, 500)}`);

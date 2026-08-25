import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { evaluateCrashLoop, redactSensitive } from "./resilience-core.mjs";

const appName = process.env.WATCHDOG_APP_NAME || "plataforma-ambiental";
const pollMs = Number(process.env.WATCHDOG_POLL_SECONDS || 30) * 1000;
const windowMs = Number(process.env.WATCHDOG_WINDOW_SECONDS || 300) * 1000;
const threshold = Number(process.env.WATCHDOG_RESTART_THRESHOLD || 3);
const cooldownMs = Number(process.env.WATCHDOG_COOLDOWN_SECONDS || 1800) * 1000;
const stateFile = process.env.WATCHDOG_STATE_FILE || "/var/lib/plataforma-watchdog/state.json";
const incidentRoot = process.env.INCIDENT_ROOT || "/var/lib/plataforma-watchdog/incidents";
const backupScript = process.env.BACKUP_SCRIPT || path.resolve("ops/backup-database.sh");
const notifierScript = process.env.INCIDENT_NOTIFIER || path.resolve("ops/notify-incident.mjs");
const rollbackScript = process.env.ROLLBACK_SCRIPT || path.resolve("ops/rollback-to-previous.sh");

fs.mkdirSync(path.dirname(stateFile), { recursive: true, mode: 0o700 });
fs.mkdirSync(incidentRoot, { recursive: true, mode: 0o700 });

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return { lastRestartCount: 0, restartEvents: [], lastIncidentAt: 0 };
  }
}

function saveState(state) {
  const temporary = `${stateFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, stateFile);
}

function command(commandName, args, maxBuffer = 50 * 1024 * 1024) {
  try {
    return execFileSync(commandName, args, { encoding: "utf8", maxBuffer, env: process.env });
  } catch (error) {
    return `${error.stdout || ""}\n${error.stderr || error.message || "command_failed"}`;
  }
}

function copyLog(source, target) {
  if (!source || !fs.existsSync(source)) return;
  const stat = fs.statSync(source);
  const maxBytes = 50 * 1024 * 1024;
  if (stat.size <= maxBytes) {
    fs.copyFileSync(source, target);
    return;
  }
  const fd = fs.openSync(source, "r");
  const buffer = Buffer.alloc(maxBytes);
  fs.readSync(fd, buffer, 0, maxBytes, stat.size - maxBytes);
  fs.closeSync(fd);
  fs.writeFileSync(target, buffer);
}

function captureIncident(processInfo, state, now) {
  const incidentId = `${appName}-${new Date(now).toISOString().replace(/[:.]/g, "-")}`;
  const directory = path.join(incidentRoot, incidentId);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });

  const backup = spawnSync("bash", [backupScript], { encoding: "utf8", env: process.env });
  const backupStatus = backup.status === 0
    ? `ok:${backup.stdout.trim().split("\n").at(-1)}`
    : `failed:${redactSensitive(backup.stderr || backup.stdout || "unknown")}`;

  const describe = command("pm2", ["describe", appName]);
  const recentLogs = command("pm2", ["logs", appName, "--lines", "1000", "--nostream", "--raw"]);
  fs.writeFileSync(path.join(directory, "pm2-describe.txt"), describe, { mode: 0o600 });
  fs.writeFileSync(path.join(directory, "pm2-recent.log"), recentLogs, { mode: 0o600 });

  const env = processInfo.pm2_env || {};
  copyLog(env.pm_err_log_path, path.join(directory, "pm2-error-full.log"));
  copyLog(env.pm_out_log_path, path.join(directory, "pm2-output-full.log"));

  const sanitized = redactSensitive(recentLogs).slice(-16000);
  fs.writeFileSync(path.join(directory, "sanitized-excerpt.log"), sanitized, { mode: 0o600 });

  let recoveryStatus = "not_requested";
  if (process.env.WATCHDOG_AUTO_ROLLBACK === "true") {
    if (backup.status !== 0) {
      recoveryStatus = "blocked_backup_failed";
    } else {
      const rollback = spawnSync("bash", [rollbackScript], {
        encoding: "utf8",
        env: { ...process.env, ROLLBACK_SKIP_BACKUP: "true" },
      });
      recoveryStatus = rollback.status === 0
        ? `rolled_back:${redactSensitive(rollback.stdout.trim().split("\n").at(-1) || "ok")}`
        : `rollback_failed:${redactSensitive(rollback.stderr || rollback.stdout || "unknown")}`;
      fs.writeFileSync(
        path.join(directory, "rollback-result.log"),
        redactSensitive(`${rollback.stdout || ""}\n${rollback.stderr || ""}`),
        { mode: 0o600 },
      );
    }
  }

  const incident = {
    incidentId,
    appName,
    detectedAt: new Date(now).toISOString(),
    pm2Status: env.status || "unknown",
    restartCount: state.restartEvents.length,
    backupStatus,
    recoveryStatus,
    incidentDirectory: directory,
    logExcerpt: sanitized,
  };
  const incidentPath = path.join(directory, "incident.json");
  fs.writeFileSync(incidentPath, JSON.stringify(incident, null, 2), { mode: 0o600 });

  const notified = spawnSync(process.execPath, [notifierScript, incidentPath], {
    encoding: "utf8",
    env: process.env,
  });
  fs.writeFileSync(
    path.join(directory, "notification-result.log"),
    redactSensitive(`${notified.stdout || ""}\n${notified.stderr || ""}`),
    { mode: 0o600 },
  );
}

function inspect() {
  const now = Date.now();
  const state = loadState();
  let processes;
  try {
    processes = JSON.parse(command("pm2", ["jlist"]));
  } catch {
    processes = [];
  }
  const processInfo = processes.find(item => item.name === appName);
  if (!processInfo) {
    const outsideCooldown = now - Number(state.lastIncidentAt || 0) >= cooldownMs;
    if (outsideCooldown) {
      state.restartEvents = Array.from({ length: threshold }, () => now);
      captureIncident({ pm2_env: { status: "missing", restart_time: state.lastRestartCount } }, state, now);
      state.lastIncidentAt = now;
    }
    saveState(state);
    return;
  }

  const evaluation = evaluateCrashLoop({
    previousState: state,
    restartCount: Number(processInfo.pm2_env?.restart_time || 0),
    status: processInfo.pm2_env?.status,
    now,
    threshold,
    windowMs,
    cooldownMs,
  });
  Object.assign(state, evaluation.state);

  if (evaluation.shouldCreateIncident) {
    captureIncident(processInfo, state, now);
    state.lastIncidentAt = now;
  }
  saveState(state);
}

console.log(`[watchdog] A vigiar ${appName} a cada ${pollMs / 1000}s`);
inspect();
if (process.env.WATCHDOG_ONCE !== "true") {
  setInterval(() => {
    try {
      inspect();
    } catch (error) {
      console.error("[watchdog]", redactSensitive(error?.stack || error));
    }
  }, pollMs);
}

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const temporaryRoots: string[] = [];

function temporaryDirectory() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "platform-resilience-"));
  temporaryRoots.push(directory);
  return directory;
}

function executable(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode: 0o755 });
}

function fakePm2(bin: string) {
  executable(path.join(bin, "pm2"), "#!/usr/bin/env bash\nexit 0\n");
}

afterEach(() => {
  for (const directory of temporaryRoots.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("resilience shell scripts", () => {
  it("refuses to create a backup without DATABASE_URL", () => {
    const result = spawnSync("bash", [path.join(projectRoot, "ops/backup-database.sh")], {
      encoding: "utf8",
      env: { PATH: process.env.PATH || "" },
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("DATABASE_URL não está definida");
  });

  it("accepts a readiness endpoint after transient failures", () => {
    const root = temporaryDirectory();
    const bin = path.join(root, "bin");
    const counter = path.join(root, "curl-count");
    executable(
      path.join(bin, "curl"),
      `#!/usr/bin/env bash\ncount=$(cat "${counter}" 2>/dev/null || echo 0)\ncount=$((count+1))\necho "$count" > "${counter}"\n[[ "$count" -ge 3 ]]\n`,
    );

    const result = spawnSync("bash", [path.join(projectRoot, "ops/verify-health.sh"), "https://health.invalid"], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        HEALTH_ATTEMPTS: "3",
        HEALTH_INTERVAL_SECONDS: "0",
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("tentativa 3");
  });

  it("rolls back atomically to the previous validated release", () => {
    const root = temporaryDirectory();
    const appRoot = path.join(root, "app");
    const bin = path.join(root, "bin");
    const oldRelease = path.join(appRoot, "releases", "old");
    const currentRelease = path.join(appRoot, "releases", "current-broken");
    const envFile = path.join(root, "app.env");
    fs.mkdirSync(path.join(oldRelease, "ops"), { recursive: true });
    fs.mkdirSync(currentRelease, { recursive: true });
    fs.writeFileSync(path.join(oldRelease, "ecosystem.config.cjs"), "module.exports={apps:[]};\n");
    executable(path.join(oldRelease, "ops", "verify-health.sh"), "#!/usr/bin/env bash\nexit 0\n");
    fs.writeFileSync(envFile, "NODE_ENV=production\n");
    fs.symlinkSync(currentRelease, path.join(appRoot, "current"));
    fs.writeFileSync(path.join(appRoot, "previous-stable-release"), `${oldRelease}\n`);
    fakePm2(bin);

    const result = spawnSync("bash", [path.join(projectRoot, "ops/rollback-to-previous.sh")], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        APP_ROOT: appRoot,
        APP_ENV_FILE: envFile,
        DEPLOY_HEALTH_URL: "https://health.invalid",
        ROLLBACK_SKIP_BACKUP: "true",
      },
    });

    expect(result.status).toBe(0);
    expect(fs.realpathSync(path.join(appRoot, "current"))).toBe(fs.realpathSync(oldRelease));
    expect(fs.readFileSync(path.join(appRoot, "previous-stable-release"), "utf8").trim()).toBe(currentRelease);
  });

  it("restores the previous release when the new health check fails", () => {
    const root = temporaryDirectory();
    const appRoot = path.join(root, "app");
    const bin = path.join(root, "bin");
    const oldRelease = path.join(appRoot, "releases", "old");
    const sourceRelease = path.join(root, "source-release");
    const archive = path.join(appRoot, "incoming", "release-broken.tar.gz");
    const envFile = path.join(root, "app.env");

    fs.mkdirSync(path.join(oldRelease, "ops"), { recursive: true });
    fs.mkdirSync(path.join(sourceRelease, "dist"), { recursive: true });
    fs.mkdirSync(path.join(sourceRelease, "ops"), { recursive: true });
    fs.mkdirSync(path.join(sourceRelease, "drizzle"), { recursive: true });
    fs.mkdirSync(path.dirname(archive), { recursive: true });

    fs.writeFileSync(path.join(oldRelease, "ecosystem.config.cjs"), "module.exports={apps:[]};\n");
    executable(path.join(oldRelease, "ops", "backup-database.sh"), "#!/usr/bin/env bash\necho /tmp/backup-ok.sql.gz\n");
    executable(path.join(oldRelease, "ops", "verify-health.sh"), "#!/usr/bin/env bash\nexit 0\n");
    fs.symlinkSync(oldRelease, path.join(appRoot, "current"));
    fs.writeFileSync(envFile, "NODE_ENV=production\n");

    fs.writeFileSync(path.join(sourceRelease, "dist", "index.js"), "console.log('release');\n");
    fs.writeFileSync(path.join(sourceRelease, "package.json"), '{"name":"test","version":"1.0.0"}\n');
    fs.writeFileSync(path.join(sourceRelease, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    fs.writeFileSync(path.join(sourceRelease, "ecosystem.config.cjs"), "module.exports={apps:[]};\n");
    executable(path.join(sourceRelease, "ops", "verify-health.sh"), "#!/usr/bin/env bash\nexit 1\n");
    executable(path.join(sourceRelease, "ops", "backup-database.sh"), "#!/usr/bin/env bash\necho /tmp/unused.sql.gz\n");
    fs.copyFileSync(path.join(projectRoot, "ops/deploy-release.sh"), path.join(sourceRelease, "ops/deploy-release.sh"));
    fs.chmodSync(path.join(sourceRelease, "ops/deploy-release.sh"), 0o755);

    execFileSync("tar", ["-czf", archive, "-C", sourceRelease, "."]);
    fakePm2(bin);
    executable(path.join(bin, "pnpm"), "#!/usr/bin/env bash\nexit 0\n");

    const result = spawnSync(
      "bash",
      [path.join(projectRoot, "ops/deploy-release.sh"), archive, "broken-release"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          APP_ROOT: appRoot,
          APP_ENV_FILE: envFile,
          DEPLOY_HEALTH_URL: "https://health.invalid",
        },
      },
    );

    expect(result.status).not.toBe(0);
    expect(fs.realpathSync(path.join(appRoot, "current"))).toBe(fs.realpathSync(oldRelease));
    expect(result.stderr).toContain("a repor");
  });

  it("captures and sanitizes a PM2 crash-loop before notifying", () => {
    const root = temporaryDirectory();
    const bin = path.join(root, "bin");
    const incidents = path.join(root, "incidents");
    const state = path.join(root, "state.json");
    const backup = path.join(root, "backup.sh");
    const notifier = path.join(root, "notifier.mjs");
    const notified = path.join(root, "notified.json");
    const errorLog = path.join(root, "error.log");
    const outputLog = path.join(root, "output.log");

    fs.writeFileSync(errorLog, "token=full-log-token\n");
    fs.writeFileSync(outputLog, "application output\n");
    executable(backup, "#!/usr/bin/env bash\necho /tmp/validated-backup.sql.gz\n");
    executable(
      notifier,
      `import fs from "node:fs"; fs.copyFileSync(process.argv[2], "${notified}");\n`,
    );
    executable(
      path.join(bin, "pm2"),
      `#!/usr/bin/env bash
case "$1" in
  jlist)
    printf '%s' '[{"name":"plataforma-ambiental","pm2_env":{"restart_time":3,"status":"online","pm_err_log_path":"${errorLog}","pm_out_log_path":"${outputLog}"}}]'
    ;;
  describe)
    echo 'PM2 describe output'
    ;;
  logs)
    echo 'Authorization: Bearer secret-token password=secret-pass mysql://user:pass@db/app'
    ;;
esac
`,
    );

    const result = spawnSync(process.execPath, [path.join(projectRoot, "ops/pm2-crash-watchdog.mjs")], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        WATCHDOG_ONCE: "true",
        WATCHDOG_APP_NAME: "plataforma-ambiental",
        WATCHDOG_STATE_FILE: state,
        INCIDENT_ROOT: incidents,
        BACKUP_SCRIPT: backup,
        INCIDENT_NOTIFIER: notifier,
        WATCHDOG_AUTO_ROLLBACK: "false",
      },
    });

    expect(result.status).toBe(0);
    expect(fs.existsSync(notified)).toBe(true);
    const incident = JSON.parse(fs.readFileSync(notified, "utf8"));
    expect(incident.backupStatus).toContain("validated-backup.sql.gz");
    expect(incident.logExcerpt).toContain("[REDACTED]");
    expect(incident.logExcerpt).not.toContain("secret-token");
    expect(incident.logExcerpt).not.toContain("secret-pass");
    expect(incident.logExcerpt).not.toContain("user:pass");
  });

  it("blocks automatic rollback when the mandatory backup fails", () => {
    const root = temporaryDirectory();
    const bin = path.join(root, "bin");
    const incidents = path.join(root, "incidents");
    const backup = path.join(root, "backup-fails.sh");
    const rollback = path.join(root, "rollback-should-not-run.sh");
    const rollbackMarker = path.join(root, "rollback-called");
    const notifier = path.join(root, "notifier.mjs");
    const notified = path.join(root, "notified.json");

    executable(backup, "#!/usr/bin/env bash\necho backup failed >&2\nexit 1\n");
    executable(rollback, `#!/usr/bin/env bash\ntouch "${rollbackMarker}"\n`);
    executable(notifier, `import fs from "node:fs"; fs.copyFileSync(process.argv[2], "${notified}");\n`);
    executable(
      path.join(bin, "pm2"),
      `#!/usr/bin/env bash
case "$1" in
  jlist) printf '%s' '[{"name":"plataforma-ambiental","pm2_env":{"restart_time":3,"status":"errored"}}]' ;;
  describe) echo 'errored' ;;
  logs) echo 'fatal error' ;;
esac
`,
    );

    const result = spawnSync(process.execPath, [path.join(projectRoot, "ops/pm2-crash-watchdog.mjs")], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        WATCHDOG_ONCE: "true",
        WATCHDOG_APP_NAME: "plataforma-ambiental",
        WATCHDOG_STATE_FILE: path.join(root, "state.json"),
        INCIDENT_ROOT: incidents,
        BACKUP_SCRIPT: backup,
        ROLLBACK_SCRIPT: rollback,
        INCIDENT_NOTIFIER: notifier,
        WATCHDOG_AUTO_ROLLBACK: "true",
      },
    });

    expect(result.status).toBe(0);
    expect(fs.existsSync(rollbackMarker)).toBe(false);
    const incident = JSON.parse(fs.readFileSync(notified, "utf8"));
    expect(incident.recoveryStatus).toBe("blocked_backup_failed");
  });

  it("fails incident delivery when no alert channel is configured", () => {
    const root = temporaryDirectory();
    const incidentPath = path.join(root, "incident.json");
    fs.writeFileSync(
      incidentPath,
      JSON.stringify({
        incidentId: "incident-without-channel",
        detectedAt: new Date(0).toISOString(),
        pm2Status: "errored",
        restartCount: 3,
        backupStatus: "ok:/tmp/backup.sql.gz",
        recoveryStatus: "not_requested",
        logExcerpt: "fatal error",
      }),
    );

    const result = spawnSync(process.execPath, [path.join(projectRoot, "ops/notify-incident.mjs"), incidentPath], {
      encoding: "utf8",
      env: { PATH: process.env.PATH || "", NODE_PATH: process.env.NODE_PATH || "" },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Nenhum canal de alerta");
  });

  it("rejects a deployment archive containing path traversal", () => {
    const root = temporaryDirectory();
    const appRoot = path.join(root, "app");
    const source = path.join(root, "source");
    const archive = path.join(root, "malicious.tar.gz");
    const envFile = path.join(root, "app.env");
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(appRoot, { recursive: true });
    fs.writeFileSync(path.join(source, "payload"), "blocked");
    fs.writeFileSync(envFile, "NODE_ENV=production\n");
    execFileSync("tar", ["-czf", archive, "--transform=s,^,../,", "-C", source, "payload"]);

    const result = spawnSync(
      "bash",
      [path.join(projectRoot, "ops/deploy-release.sh"), archive, "malicious-release"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          APP_ROOT: appRoot,
          APP_ENV_FILE: envFile,
        },
      },
    );

    expect(result.status).toBe(9);
    expect(result.stderr).toContain("caminhos fora da release");
    expect(fs.existsSync(path.join(root, "payload"))).toBe(false);
  });
});

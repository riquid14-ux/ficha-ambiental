const dotenv = require("dotenv");

const cwd = process.env.APP_CURRENT_PATH || "/opt/plataforma-ambiental/current";
const envFile = process.env.APP_ENV_FILE || "/etc/plataforma-ambiental/app.env";
const applicationEnv = dotenv.config({ path: envFile }).parsed || {};

module.exports = {
  apps: [
    {
      name: "plataforma-ambiental",
      cwd,
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      min_uptime: "15s",
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "750M",
      kill_timeout: 10000,
      listen_timeout: 10000,
      wait_ready: false,
      time: true,
      env_production: {
        ...applicationEnv,
        NODE_ENV: "production",
      },
    },
  ],
};

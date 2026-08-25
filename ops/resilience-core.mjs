export function redactSensitive(value) {
  return String(value)
    .replace(/(authorization\s*[:=]\s*)(bearer\s+)?[^\s]+/gi, "$1[REDACTED]")
    .replace(/(cookie\s*[:=]\s*)[^\n]+/gi, "$1[REDACTED]")
    .replace(/(password|passwd|secret|token|api[_-]?key)(\s*[:=]\s*)[^\s,;]+/gi, "$1$2[REDACTED]")
    .replace(/mysql:\/\/[^\s]+/gi, "mysql://[REDACTED]");
}

export function evaluateCrashLoop({
  previousState,
  restartCount,
  status,
  now,
  threshold,
  windowMs,
  cooldownMs,
}) {
  const state = {
    lastRestartCount: Number(previousState?.lastRestartCount || 0),
    restartEvents: Array.isArray(previousState?.restartEvents) ? [...previousState.restartEvents] : [],
    lastIncidentAt: Number(previousState?.lastIncidentAt || 0),
  };

  const restartDelta = Math.max(0, Number(restartCount || 0) - state.lastRestartCount);
  for (let index = 0; index < Math.min(restartDelta, threshold); index += 1) {
    state.restartEvents.push(now);
  }
  state.restartEvents = state.restartEvents.filter(timestamp => now - timestamp <= windowMs);
  state.lastRestartCount = Number(restartCount || 0);

  const crashLoop = state.restartEvents.length >= threshold || status === "errored";
  const outsideCooldown = now - state.lastIncidentAt >= cooldownMs;

  return { state, shouldCreateIncident: crashLoop && outsideCooldown };
}

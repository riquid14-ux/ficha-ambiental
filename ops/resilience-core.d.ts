export function redactSensitive(value: unknown): string;

export function evaluateCrashLoop(input: {
  previousState?: {
    lastRestartCount?: number;
    restartEvents?: number[];
    lastIncidentAt?: number;
  };
  restartCount: number;
  status?: string;
  now: number;
  threshold: number;
  windowMs: number;
  cooldownMs: number;
}): {
  state: {
    lastRestartCount: number;
    restartEvents: number[];
    lastIncidentAt: number;
  };
  shouldCreateIncident: boolean;
};

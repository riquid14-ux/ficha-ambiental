export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

// DATA-03 FIX: Canonical phase definitions — single source of truth for phase names
// Used by Timeline, Dashboard, Fases, and WeeklyForm to ensure consistency
export const PHASE_DEFS = [
  { key: "pre_licenciamento", name: "Pré-Licenciamento", short: "Pré-Lic.", order: 1 },
  { key: "licenciamento", name: "Licenciamento", short: "Lic.", order: 2 },
  { key: "pre_construcao", name: "Pré-Construção", short: "Pré-Const.", order: 3 },
  { key: "preparacao_previa", name: "Preparação Prévia", short: "Prep.", order: 4 },
  { key: "execucao", name: "Execução da Obra", short: "Exec.", order: 5 },
  { key: "fase_final", name: "Fase Final de Construção", short: "Final Const.", order: 6 },
  { key: "final_construcao", name: "Final de Construção", short: "Final", order: 7 },
  { key: "exploracao", name: "Exploração / Operação", short: "Operação", order: 8 },
  { key: "desativacao", name: "Desativação", short: "Desativ.", order: 9 },
] as const;

// Human-readable role names (FLOW-10 fix)
export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  dono_obra: "Dono de Obra",
  pm: "Project Manager",
  ee: "Entidade Executante",
  rap: "Resp. Acomp. Patrimonial",
  raa: "Resp. Acomp. Ambiental",
  observador: "Observador",
  user: "Utilizador",
};

// One-time nonce cookie that binds an OAuth login to the browser that started
// it. The `__Host-` prefix forces the cookie host-only (Secure, Path=/, no
// Domain), so a sibling *.manus.space site cannot plant a matching value in a
// victim's browser.
export const OAUTH_STATE_COOKIE = "__Host-oauth_state";

// `state` carries the callback redirect URI (used at token exchange) plus the
// CSRF nonce. Defined here so the client encoder and server decoder never drift.
export type OAuthState = { redirectUri: string; nonce?: string };

export const encodeOAuthState = (state: OAuthState): string =>
  btoa(JSON.stringify(state));

export const decodeOAuthState = (state: string): OAuthState => {
  let decoded: string;
  try {
    decoded = atob(state);
  } catch {
    // Malformed base64 (e.g. attacker-supplied garbage). Return no nonce so the
    // callback's CSRF guard rejects it with 403 — never throw, since the caller
    // runs outside the request handler's try/catch.
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
    // Legacy links: `state` was a bare base64(redirectUri) with no nonce.
  }
  return { redirectUri: decoded };
};

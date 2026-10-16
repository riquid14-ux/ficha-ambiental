export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/** Abre a página de autenticação local da STAND. */
export const startLogin = () => {
  window.location.href = "/login";
};

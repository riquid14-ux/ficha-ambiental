export type BrandImageMode = "background" | "side";

export type BrandImageDefinition = {
  key: string;
  pageKey: string;
  label: string;
  description: string;
  fallback: string;
  position: string;
  mode?: BrandImageMode;
};

/**
 * Fotografias oficiais descarregadas da biblioteca de marca Start Campus.
 * Cada página recebe uma composição distinta para preservar a orientação
 * do utilizador e evitar repetição entre módulos vizinhos.
 */
export const BRAND_IMAGE_DEFINITIONS: BrandImageDefinition[] = [
  { key: "image_dashboard", pageKey: "dashboard", label: "Dashboard", description: "Cabeçalho da visão consolidada de conformidade.", fallback: "/manus-storage/start-campus-9_0e9ab8b0.jpg", position: "center 46%" },
  { key: "image_calendario", pageKey: "calendario", label: "Calendário", description: "Cabeçalho de prazos, entregas e reporting.", fallback: "/manus-storage/start-campus-17_de17c18d.jpg", position: "center 58%" },
  { key: "image_timeline", pageKey: "timeline", label: "Timeline do projeto", description: "Cabeçalho da cronologia e execução por fase.", fallback: "/manus-storage/start-campus-10_f1d3919f.jpg", position: "center 50%" },
  { key: "image_timeline_portfolio", pageKey: "timeline_portfolio", label: "Timeline · todos os projetos", description: "Cabeçalho da visão de portefólio.", fallback: "/manus-storage/start-campus-12_e458c914.jpg", position: "center 52%" },
  { key: "image_ficha_semanal", pageKey: "ficha_semanal", label: "Ficha de controlo semanal", description: "Cabeçalho do controlo semanal de medidas ambientais.", fallback: "/manus-storage/start-campus-13_c68ebb45.jpg", position: "center 46%" },
  { key: "image_planos", pageKey: "planos", label: "Planos", description: "Cabeçalho de planos de monitorização e atualização.", fallback: "/manus-storage/start-campus-14_ed04207a.jpg", position: "center 54%" },
  { key: "image_fases", pageKey: "fases", label: "Fases e medidas", description: "Cabeçalho de evidências e acompanhamento por medida.", fallback: "/manus-storage/start-campus-15_72f83746.jpg", position: "center 50%" },
  { key: "image_rdcd", pageKey: "rdcd", label: "RDCD", description: "Cabeçalho de demonstração de cumprimento.", fallback: "/manus-storage/start-campus-11_fced6e75.jpg", position: "center 52%" },
  { key: "image_historico", pageKey: "historico", label: "Histórico", description: "Cabeçalho do arquivo de submissões e aprovações.", fallback: "/manus-storage/start-campus-4_9ce4d2bc.jpg", position: "center 48%", mode: "side" },
  { key: "image_kpi", pageKey: "kpi", label: "KPI", description: "Cabeçalho de indicadores ambientais do projeto.", fallback: "/manus-storage/start-campus-5_5d8e4400.jpg", position: "center 52%" },
  { key: "image_mirr", pageKey: "mirr", label: "MIRR", description: "Cabeçalho do reporte de resíduos.", fallback: "/manus-storage/start-campus-8_1bdb1eb1.jpg", position: "center 52%" },
  { key: "image_biblioteca", pageKey: "biblioteca", label: "Biblioteca documental", description: "Cabeçalho do repositório documental.", fallback: "/manus-storage/start-campus-19_1fd1e617.jpg", position: "center 48%", mode: "side" },
  { key: "image_certificacoes", pageKey: "certificacoes", label: "Certificações", description: "Cabeçalho de certificações e reporte ambiental.", fallback: "/manus-storage/start-campus-6_49846847.jpg", position: "center 48%" },
  { key: "image_matriz", pageKey: "matriz", label: "Matriz de acompanhamento", description: "Cabeçalho da matriz de estados e responsabilidades.", fallback: "/manus-storage/start-campus-18_9a4385f8.jpg", position: "center 47%" },
  { key: "image_operacao", pageKey: "operacao", label: "Operação NEST · SIN01", description: "Cabeçalho do cockpit e gémeo digital do NEST.", fallback: "/manus-storage/start-campus-1_fdbe2fde.jpg", position: "center 50%" },
  { key: "image_perfil", pageKey: "perfil", label: "Perfil e segurança", description: "Cabeçalho das preferências, palavra-passe e 2FA.", fallback: "/manus-storage/start-campus-16_e7622842.jpg", position: "center 50%", mode: "side" },
  { key: "image_login", pageKey: "login", label: "Login", description: "Imagem institucional da página de acesso.", fallback: "/manus-storage/start-campus-2_23725165.jpg", position: "center 52%" },
  { key: "image_welcome", pageKey: "welcome", label: "Boas-vindas", description: "Imagem institucional da página de boas-vindas.", fallback: "/manus-storage/start-campus-7_9876e6c3.jpg", position: "center 46%" },
];

export const BRAND_IMAGE_BY_PAGE = Object.fromEntries(
  BRAND_IMAGE_DEFINITIONS.map((definition) => [definition.pageKey, definition]),
) as Record<string, BrandImageDefinition>;

export function getBrandImageDefinition(pageKey: string) {
  return BRAND_IMAGE_BY_PAGE[pageKey] || BRAND_IMAGE_BY_PAGE.dashboard;
}

/**
 * Public institutional assets are streamed from the app origin. Direct
 * /manus-storage redirects can fail in corporate browsers even when the
 * object itself exists, which would otherwise leave the visual shell blank.
 */
export function resolvePublicBrandImageUrl(url: string) {
  const prefix = "/manus-storage/";
  if (!url.startsWith(prefix)) return url;
  const key = url.slice(prefix.length);
  return `/api/brand/media?key=${encodeURIComponent(key)}`;
}

export function resolveBrandImage(settings: Record<string, string> | undefined, pageKey: string) {
  const definition = getBrandImageDefinition(pageKey);
  const customKey = Object.entries(settings || {}).find(
    ([key, value]) =>
      key.startsWith("image_custom_") &&
      !key.endsWith("_page") &&
      !key.endsWith("_position") &&
      !key.endsWith("_mode") &&
      Boolean(value) &&
      settings?.[`${key}_page`] === pageKey,
  )?.[0];
  const key = customKey || definition.key;
  const mode = settings?.[`${key}_mode`];

  return {
    key,
    url: resolvePublicBrandImageUrl(settings?.[key] || definition.fallback),
    position: settings?.[`${key}_position`] || definition.position,
    mode: mode === "side" || mode === "background" ? mode : definition.mode || "background",
    definition,
  } as const;
}

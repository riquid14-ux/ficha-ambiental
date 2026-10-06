import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readPage = (name: string) => readFileSync(resolve(process.cwd(), "client/src/pages", name), "utf8");

describe("dashboards KPI — aplicação da paleta", () => {
  it("atribui cores semânticas distintas a combustível, eletricidade, CO₂, água, equipa e ocorrências", () => {
    const source = readPage("KPI.tsx");
    expect(source).toContain('import { DATA_SERIES_COLOR, DATA_SERIES_PALETTE } from "@shared/chart-palette";');
    for (const key of ["fuel", "electricity", "carbon", "water", "workforce", "transport", "incident"]) {
      expect(source).toContain(`DATA_SERIES_COLOR.${key}`);
    }
    expect(source).toContain('dataKey="cumEmissions"');
    expect(source).not.toContain('dataKey="cumFuel"');
  });

  it("elimina o fundo verde genérico e aplica a mesma semântica ao dashboard de parceiros", () => {
    const source = readPage("PartnerDashboard.tsx");
    expect(source).toContain('import { DATA_SERIES_COLOR, DATA_SERIES_PALETTE } from "@shared/chart-palette";');
    expect(source).toContain('const chartColors = DATA_SERIES_PALETTE;');
    expect(source).toContain('className="border-border bg-card"');
    expect(source).not.toContain('from-emerald-50 to-white');
  });

  it("dá escala à análise e torna a comparação por entidade explícita", () => {
    const partner = readPage("PartnerDashboard.tsx");
    const kpi = readPage("KPI.tsx");
    expect(partner).toContain('const companySeries = useMemo');
    expect(partner).toContain('const companySeriesDefinitions = useMemo');
    expect(partner).toContain('height="h-[27rem]"');
    expect(partner).toContain('StandPageHeader');
    expect(kpi).toContain('function ChartCard({ title, subtitle, children, h = "h-[24rem]", className = "" }');
    expect(kpi).toContain('className={`stand-chart');
    expect(kpi).toContain('className="xl:col-span-7"');
    expect(kpi).toContain('className="xl:col-span-6"');
  });

  it("expõe um Word de estado global sem inferir dados de origem", () => {
    const dashboard = readPage("Dashboard.tsx");
    expect(dashboard).toContain("handlePortfolioStatusReport");
    expect(dashboard).toContain("Estado_Portefolio_Ambiental_");
    expect(dashboard).toContain("O relatório é uma fotografia de acompanhamento");
    expect(dashboard).toContain("utils.phaseMeasures.transitionReport.fetch");
    expect(dashboard).toContain("allCalendarEventsQuery");
  });
});

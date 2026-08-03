import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import { useState, useMemo } from "react";
import { CheckCircle, AlertTriangle, MinusCircle, Building2 } from "lucide-react";

const STATUS_COLORS = {
  I: "#22c55e",
  C: "#3b82f6",
  NC: "#ef4444",
  NA: "#94a3b8",
};

const STATUS_LABELS = {
  I: "Implementado",
  C: "Conforme",
  NC: "Não Conforme",
  NA: "Não Aplicável",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");

  const companiesQuery = trpc.companies.list.useQuery();
  const sectionsQuery = trpc.sections.list.useQuery();

  const canSeeAll = user?.role === "admin" || user?.role === "dono_obra" || user?.role === "raa";
  const submissionsQuery = canSeeAll
    ? trpc.submissions.listAll.useQuery({})
    : trpc.submissions.mySubmissions.useQuery();

  // Extract unique weeks from submissions
  const weeks = useMemo(() => {
    const data = submissionsQuery.data || [];
    const unique = new Map<string, { weekNumber: number; weekYear: number }>();
    for (const s of data) {
      const key = `${s.weekYear}-${s.weekNumber}`;
      if (!unique.has(key)) unique.set(key, { weekNumber: s.weekNumber, weekYear: s.weekYear });
    }
    return Array.from(unique.values()).sort((a, b) => b.weekYear - a.weekYear || b.weekNumber - a.weekNumber);
  }, [submissionsQuery.data]);

  const analyticsQuery = trpc.analytics.overview.useQuery({
    companyId: selectedCompany !== "all" ? Number(selectedCompany) : undefined,
    sectionId: selectedSection !== "all" ? Number(selectedSection) : undefined,
    weekYear: selectedWeek !== "all" ? Number(selectedWeek.split("-")[0]) : undefined,
    weekNumber: selectedWeek !== "all" ? Number(selectedWeek.split("-")[1]) : undefined,
  });

  const analytics = analyticsQuery.data;

  // Cumulative project evolution data (from byWeek)
  const projectEvolution = useMemo(() => {
    if (!analytics?.byWeek || analytics.byWeek.length === 0) return [];
    let cumI = 0, cumC = 0, cumNC = 0, cumNA = 0;
    return analytics.byWeek.map((w: any) => {
      cumI += w.I;
      cumC += w.C;
      cumNC += w.NC;
      cumNA += w.NA;
      const total = cumI + cumC + cumNC + cumNA;
      return {
        week: w.week,
        conformidade: total > 0 ? Math.round(((cumI + cumC) / total) * 100) : 0,
        naoConformidade: total > 0 ? Math.round((cumNC / total) * 100) : 0,
      };
    });
  }, [analytics]);

  // Pie data for status distribution
  const pieData = useMemo(() => {
    if (!analytics?.byStatus) return [];
    return Object.entries(analytics.byStatus)
      .filter(([, v]) => (v as number) > 0)
      .map(([key, value]) => ({
        name: STATUS_LABELS[key as keyof typeof STATUS_LABELS],
        value,
        color: STATUS_COLORS[key as keyof typeof STATUS_COLORS],
      }));
  }, [analytics]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-1">Visão geral do cumprimento ambiental</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {canSeeAll && (
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {companiesQuery.data?.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.companyType === "rap" ? "RAP - " : ""}{c.shortName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={selectedWeek} onValueChange={setSelectedWeek}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Semana" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as semanas</SelectItem>
                {weeks.map((w) => (
                  <SelectItem key={`${w.weekYear}-${w.weekNumber}`} value={`${w.weekYear}-${w.weekNumber}`}>
                    S{w.weekNumber}/{w.weekYear}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Secção" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as secções</SelectItem>
                {sectionsQuery.data?.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>{s.name.length > 40 ? s.name.slice(0, 40) + "..." : s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100"><CheckCircle className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{(analytics?.byStatus as any)?.I ?? 0}</p>
                <p className="text-xs text-muted-foreground">Implementado</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100"><CheckCircle className="w-5 h-5 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{(analytics?.byStatus as any)?.C ?? 0}</p>
                <p className="text-xs text-muted-foreground">Conforme</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{(analytics?.byStatus as any)?.NC ?? 0}</p>
                <p className="text-xs text-muted-foreground">Não Conforme</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100"><MinusCircle className="w-5 h-5 text-slate-500" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">{(analytics?.byStatus as any)?.NA ?? 0}</p>
                <p className="text-xs text-muted-foreground">Não Aplicável</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1: Weekly Evolution + Project Evolution */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução Semanal</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.byWeek && analytics.byWeek.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.byWeek}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="I" name="Implementado" fill={STATUS_COLORS.I} stackId="a" />
                    <Bar dataKey="C" name="Conforme" fill={STATUS_COLORS.C} stackId="a" />
                    <Bar dataKey="NC" name="Não Conforme" fill={STATUS_COLORS.NC} stackId="a" />
                    <Bar dataKey="NA" name="Não Aplicável" fill={STATUS_COLORS.NA} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados disponíveis
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução do Projeto (Acumulado)</CardTitle>
            </CardHeader>
            <CardContent>
              {projectEvolution.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={projectEvolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Legend />
                    <Line type="monotone" dataKey="conformidade" name="Conformidade (I+C)" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="naoConformidade" name="Não Conformidade" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados disponíveis
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2: Distribution by Company + Status Pie */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Distribuição por Entidade Executante
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(analytics as any)?.byCompany && (analytics as any).byCompany.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={(analytics as any).byCompany}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="companyName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="I" name="Implementado" fill={STATUS_COLORS.I} stackId="a" />
                    <Bar dataKey="C" name="Conforme" fill={STATUS_COLORS.C} stackId="a" />
                    <Bar dataKey="NC" name="Não Conforme" fill={STATUS_COLORS.NC} stackId="a" />
                    <Bar dataKey="NA" name="Não Aplicável" fill={STATUS_COLORS.NA} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados disponíveis
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição por Estado</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados disponíveis
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* By Section */}
        {analytics?.bySection && analytics.bySection.some((s: any) => s.I + s.C + s.NC + s.NA > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cumprimento por Secção</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={analytics.bySection.filter((s: any) => s.I + s.C + s.NC + s.NA > 0)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="sectionName"
                    width={200}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) => v.length > 30 ? v.slice(0, 30) + "..." : v}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="I" name="Implementado" fill={STATUS_COLORS.I} stackId="a" />
                  <Bar dataKey="C" name="Conforme" fill={STATUS_COLORS.C} stackId="a" />
                  <Bar dataKey="NC" name="Não Conforme" fill={STATUS_COLORS.NC} stackId="a" />
                  <Bar dataKey="NA" name="Não Aplicável" fill={STATUS_COLORS.NA} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

#!/usr/bin/env node
/**
 * Dados demonstrativos reversíveis para o cockpit Operação (SIN01/NEST).
 * Todos os registos criados têm isDemo=1 e podem ser removidos com
 * `pnpm seed:demo -- --remove`; não toca em leituras, faturas ou cenários reais.
 */
import mysql from "mysql2/promise";

const removeOnly = process.argv.includes("--remove");
const DEMO_MARKER = "[DEMO STAND REMOVÍVEL]";
const DEMO_COMPANY_SHORT_NAME = "DEMO-STAND";
const DEMO_SOURCE_PREFIX = "demo-stand:";
const DAY = 86_400_000;
const quarter = 15 * 60_000;
const now = new Date();
const noonUtc = date =>
  Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
const asDate = time => new Date(time).toISOString().slice(0, 10);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 3) => Number(value.toFixed(digits));
const addCivilMonths = (timestamp, months) => {
  const value = new Date(timestamp);
  const sourceDay = value.getUTCDate();
  const target = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months + 1, 0, 12)
  );
  target.setUTCDate(Math.min(sourceDay, target.getUTCDate()));
  return target.getTime();
};
const addDays = (timestamp, days) => timestamp + days * DAY;
const isoWeek = timestamp => {
  const date = new Date(timestamp);
  const utc = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  utc.setUTCDate(utc.getUTCDate() + 4 - (utc.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return {
    year: utc.getUTCFullYear(),
    week: Math.ceil(((utc - yearStart) / DAY + 1) / 7),
  };
};

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [[project]] = await connection.query(
    "SELECT id FROM projects WHERE code = 'SIN01' LIMIT 1"
  );
  if (!project) throw new Error("Projeto SIN01 não encontrado.");
  const [[actor]] = await connection.query(
    "SELECT id FROM users WHERE role = 'admin' AND accountStatus = 'active' ORDER BY id ASC LIMIT 1"
  );
  if (!actor)
    throw new Error(
      "É necessária uma conta administrativa ativa para criar os dados de demonstração."
    );
  const projectId = Number(project.id);
  const userId = Number(actor.id);
  const [[sin02]] = await connection.query(
    "SELECT id FROM projects WHERE code = 'SIN02' LIMIT 1"
  );

  await connection.beginTransaction();
  await removePlatformDemonstration(connection);
  // A ordem evita referências pendentes e mantém todos os dados reais intactos.
  await connection.query(
    "DELETE FROM operation_readings WHERE projectId = ? AND isDemo = 1",
    [projectId]
  );
  await connection.query(
    "DELETE FROM operation_import_batches WHERE projectId = ? AND isDemo = 1",
    [projectId]
  );
  await connection.query(
    "DELETE FROM operation_invoices WHERE projectId = ? AND isDemo = 1",
    [projectId]
  );
  await connection.query(
    "DELETE FROM operation_scenarios WHERE projectId = ? AND isDemo = 1",
    [projectId]
  );
  await connection.query(
    "DELETE FROM operation_sustainability_snapshots WHERE projectId = ? AND isDemo = 1",
    [projectId]
  );
  await connection.query(
    "DELETE FROM operation_chemical_inventory WHERE projectId = ? AND isDemo = 1",
    [projectId]
  );

  if (removeOnly) {
    await connection.commit();
    console.log(
      `Dados demonstrativos removidos do SIN01 e dos fluxos de demonstração transversais.`
    );
    process.exit(0);
  }

  const [batchResult] = await connection.query(
    `INSERT INTO operation_import_batches (projectId, sourceFilename, sourceFileKey, sourceFileUrl, sourceType, measuredDate, rowsImported, qualityStatus, qualityNotes, isDemo, importedBy)
     VALUES (?, 'DEMO_BMS_NEST_2026.xlsx', 'demo/sin01/bms-2026.xlsx', 'demo://sin01/bms-2026', 'bms_extract', ?, 0, 'warning', 'Demonstração: inclui lacunas e três leituras fora do limite para testar a qualidade.', 1, ?)`,
    [projectId, asDate(now.getTime()), userId]
  );
  const batchId = Number(batchResult.insertId);
  const readings = [];
  // A origem manual identifica explicitamente a demonstração e evita colidir com
  // uma leitura BMS real que possa existir no mesmo instante.
  const add = (
    code,
    label,
    category,
    unit,
    value,
    at,
    granularity,
    quality = "valid",
    note = null
  ) =>
    readings.push([
      projectId,
      batchId,
      code,
      label,
      category,
      unit,
      String(round(value)),
      at,
      granularity,
      "manual",
      quality,
      note,
      1,
    ]);

  // 12 meses diários: crescimento progressivo de carga e sazonalidade realista
  // da captação marítima. Alguns dias são sinalizados para testar alertas.
  const dailyStart = Date.UTC(
    now.getUTCFullYear() - 1,
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
  for (let index = 0; index < 365; index += 1) {
    const at = dailyStart + index * DAY;
    const seasonal = Math.sin((index / 365) * Math.PI * 2 - 0.7);
    const load = 7_100 + index * 3.9 + 340 * Math.sin(index / 17);
    const sea = 15.8 + seasonal * 3.8;
    const pue = 1.19 + seasonal * 0.035 + (index % 29 === 0 ? 0.02 : 0);
    const flow = 480 + seasonal * 28 + (load - 7100) / 110;
    const delta = 5.2 + seasonal * 0.35;
    const dailyQuality = [81, 193, 327].includes(index) ? "warning" : "valid";
    const note =
      dailyQuality === "warning"
        ? "Demonstração: excedência de teste para validação de alertas."
        : null;
    add(
      "site_energy_kwh_daily",
      "Energia total do site",
      "energia",
      "kWh",
      load * pue * 24,
      at,
      "diario",
      dailyQuality,
      note
    );
    add(
      "it_energy_kwh_daily",
      "Energia TI",
      "energia",
      "kWh",
      load * 24,
      at,
      "diario",
      dailyQuality,
      note
    );
    add(
      "it_power_avg_kw",
      "Carga TI média",
      "energia",
      "kW",
      load,
      at,
      "diario",
      dailyQuality,
      note
    );
    add(
      "pue",
      "PUE diário",
      "energia",
      "rácio",
      pue,
      at,
      "diario",
      dailyQuality,
      note
    );
    add(
      "wue_reportado",
      "WUE reportado",
      "agua",
      "L/kWh TI",
      0.22 + seasonal * 0.028,
      at,
      "diario",
      dailyQuality,
      note
    );
    add(
      "seawater_intake_temp_c",
      "Temperatura de captação",
      "arrefecimento",
      "°C",
      sea,
      at,
      "diario",
      dailyQuality,
      note
    );
    add(
      "seawater_return_temp_c",
      "Temperatura de descarga",
      "arrefecimento",
      "°C",
      sea + delta,
      at,
      "diario",
      dailyQuality,
      note
    );
    add(
      "seawater_delta_t_k",
      "Delta T água do mar",
      "arrefecimento",
      "K",
      delta,
      at,
      "diario",
      dailyQuality,
      note
    );
    add(
      "seawater_flow_lps",
      "Caudal de água do mar",
      "agua",
      "L/s",
      flow,
      at,
      "diario",
      dailyQuality,
      note
    );
    add(
      "seawater_pumping_cop",
      "COP de bombagem",
      "arrefecimento",
      "rácio",
      10.8 - seasonal * 0.5,
      at,
      "diario",
      dailyQuality,
      note
    );
    add(
      "heat_exchanger_approach_k",
      "Approach permutador",
      "arrefecimento",
      "K",
      1.8 + seasonal * 0.22,
      at,
      "diario",
      dailyQuality,
      note
    );
  }

  // Últimos 10 dias a 15 minutos: o cockpit obtém resolução suficiente para
  // correlações sem descarregar uma massa de dados que prejudique a interface.
  const qStart = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 9
  );
  for (let day = 0; day < 10; day += 1) {
    for (let slot = 0; slot < 96; slot += 1) {
      const at = qStart + day * DAY + slot * quarter;
      const hour = slot / 4;
      const profile = Math.sin(((hour - 14) / 24) * Math.PI * 2);
      const seasonal = Math.sin(((day + 240) / 365) * Math.PI * 2);
      const load = 8_350 + 470 * profile + day * 7;
      const sea = 18.7 + seasonal * 1.2 + profile * 0.18;
      const pue = 1.215 + profile * 0.008 + seasonal * 0.012;
      const invalid = day === 8 && slot >= 32 && slot < 40;
      const warning =
        (day === 4 && slot === 68) ||
        (day === 17 && slot === 75) ||
        (day === 26 && slot === 61);
      const state = invalid ? "invalid" : warning ? "warning" : "valid";
      const note = invalid
        ? "Demonstração: falha de sonda, excluir da análise."
        : warning
          ? "Demonstração: valor acima do limite configurado."
          : null;
      add(
        "it_power_15m_kw",
        "Carga TI",
        "energia",
        "kW",
        load,
        at,
        "quinze_minutos",
        state,
        note
      );
      add(
        "pue_15m",
        "PUE",
        "energia",
        "rácio",
        warning ? pue + 0.07 : pue,
        at,
        "quinze_minutos",
        state,
        note
      );
      add(
        "wue_15m",
        "WUE",
        "agua",
        "L/kWh TI",
        0.235 + profile * 0.012 + seasonal * 0.015,
        at,
        "quinze_minutos",
        state,
        note
      );
      add(
        "cooling_cycles_15m",
        "Ciclos de arrefecimento",
        "arrefecimento",
        "ciclos",
        3.2 + profile * 0.55 + seasonal * 0.25,
        at,
        "quinze_minutos",
        state,
        note
      );
      add(
        "seawater_intake_15m_c",
        "Temperatura de captação",
        "arrefecimento",
        "°C",
        sea,
        at,
        "quinze_minutos",
        state,
        note
      );
    }
  }

  for (let offset = 0; offset < readings.length; offset += 750) {
    const chunk = readings.slice(offset, offset + 750);
    await connection.query(
      `INSERT INTO operation_readings (projectId, batchId, metricCode, metricLabel, category, unit, value, measuredAt, granularity, source, dataQuality, qualityNote, isDemo)
       VALUES ${chunk.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",")}`,
      chunk.flat()
    );
  }
  await connection.query(
    "UPDATE operation_import_batches SET rowsImported = ? WHERE id = ?",
    [readings.length, batchId]
  );

  const invoiceRows = [];
  for (let month = 0; month < 12; month += 1) {
    const period = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - month, 1)
    );
    const start = asDate(period.getTime());
    const end = asDate(
      Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 0)
    );
    invoiceRows.push([
      projectId,
      "electricidade",
      "Fornecedor Energia Demo",
      `DEMO-EL-${start.slice(0, 7)}`,
      start,
      end,
      String(6_550_000 + month * 14_000),
      "kWh",
      String(655_000 + month * 1_500),
      "EUR",
      "conforme",
      "Demonstração",
      1,
      userId,
    ]);
    invoiceRows.push([
      projectId,
      "agua_industrial",
      "Água Industrial Demo",
      `DEMO-H2O-${start.slice(0, 7)}`,
      start,
      end,
      String(4_600 + month * 25),
      "m3",
      String(9_800 + month * 80),
      "EUR",
      month === 3 ? "desvio" : "conforme",
      "Demonstração",
      1,
      userId,
    ]);
  }
  await connection.query(
    `INSERT INTO operation_invoices (projectId, invoiceType, supplier, invoiceNumber, periodStart, periodEnd, quantity, unit, totalCost, currency, reconciliationStatus, notes, isDemo, createdBy) VALUES ${invoiceRows.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",")}`,
    invoiceRows.flat()
  );
  await connection.query(
    "INSERT INTO operation_sustainability_snapshots (projectId, recordedAt, hvoLiters, dieselLiters, absoluteCo2Tonnes, notes, isDemo, createdBy) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
    [
      projectId,
      asDate(now.getTime()),
      "18200",
      "2400",
      "7.4",
      "Demonstração: inventário de combustível e emissões operacionais.",
      userId,
    ]
  );
  await connection.query(
    "INSERT INTO operation_chemical_inventory (projectId, chemicalName, quantity, unit, safetyThreshold, location, notes, isDemo, updatedBy) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?), (?, ?, ?, ?, ?, ?, ?, 1, ?)",
    [
      projectId,
      "Biocida anti-fouling",
      "420",
      "L",
      "500",
      "Captação água do mar",
      "Demonstração: abaixo do nível mínimo para testar alerta.",
      userId,
      projectId,
      "Inibidor de corrosão",
      "1180",
      "L",
      "650",
      "Sala de tratamento",
      "Demonstração",
      userId,
    ]
  );
  const assumptions = JSON.stringify({
    tiEnergyKwh: 6_500_000,
    baselinePue: 1.24,
    baselineWaterM3: 4600,
    baselineMaintenanceEur: 78000,
    electricityPriceEurKwh: 0.1,
    waterPriceEurM3: 2.1,
    carbonFactorKgKwh: 0.28,
    targetPue: 1.18,
    targetWueLkwh: 0.24,
    maintenanceEur: 82000,
    systemMix: { agua_mar: 100, chiller: 0, hibrido_adiabatico: 0 },
  });
  await connection.query(
    "INSERT INTO operation_scenarios (projectId, name, coolingStrategy, assumptionsJson, resultJson, baselineStart, baselineEnd, isDemo, createdBy) VALUES (?, ?, 'agua_mar', ?, ?, ?, ?, 1, ?)",
    [
      projectId,
      "Demonstração — otimização de caudal",
      assumptions,
      JSON.stringify({}),
      asDate(qStart),
      asDate(now.getTime()),
      userId,
    ]
  );
  const platformSummary = sin02
    ? await seedPlatformDemonstration(connection, Number(sin02.id), userId, now)
    : null;
  await connection.commit();
  console.log(
    `Criados ${readings.length} leituras, ${invoiceRows.length} faturas e inventários demonstrativos no SIN01. Todos os registos foram marcados isDemo=1.`
  );
  if (platformSummary) {
    console.log(
      `Criados também ${platformSummary.submissions} fichas semanais aprovadas, ${platformSummary.kpiSubmissions} submissões KPI, ${platformSummary.egars} e-GARs, ${platformSummary.plans} planos e ${platformSummary.calendarEvents} eventos APA demonstrativos no SIN02. Remoção: pnpm seed:demo -- --remove.`
    );
  }
} catch (error) {
  await connection.rollback();
  console.error(error);
  process.exitCode = 1;
} finally {
  await connection.end();
}

/**
 * Remove apenas conteúdo com identificadores exclusivos de demonstração.
 * Não há SQL que toque em linhas operacionais ou de compliance reais.
 */
async function removePlatformDemonstration(connection) {
  const [[demoCompany]] = await connection.query(
    "SELECT id FROM companies WHERE shortName = ? LIMIT 1",
    [DEMO_COMPANY_SHORT_NAME]
  );
  if (demoCompany) {
    const companyId = Number(demoCompany.id);
    await connection.query(
      "DELETE ei FROM evidence_images ei JOIN measure_responses mr ON mr.id = ei.responseId JOIN weekly_submissions ws ON ws.id = mr.submissionId WHERE ws.companyId = ? AND ws.reviewNotes LIKE ?",
      [companyId, `%${DEMO_MARKER}%`]
    );
    await connection.query(
      "DELETE ef FROM evidence_files ef JOIN measure_responses mr ON mr.id = ef.responseId JOIN weekly_submissions ws ON ws.id = mr.submissionId WHERE ws.companyId = ? AND ws.reviewNotes LIKE ?",
      [companyId, `%${DEMO_MARKER}%`]
    );
    await connection.query(
      "DELETE rc FROM review_comments rc JOIN weekly_submissions ws ON ws.id = rc.submissionId WHERE ws.companyId = ? AND ws.reviewNotes LIKE ?",
      [companyId, `%${DEMO_MARKER}%`]
    );
    await connection.query(
      "DELETE rv FROM measure_reviews rv JOIN weekly_submissions ws ON ws.id = rv.submissionId WHERE ws.companyId = ? AND ws.reviewNotes LIKE ?",
      [companyId, `%${DEMO_MARKER}%`]
    );
    await connection.query(
      "DELETE mr FROM measure_responses mr JOIN weekly_submissions ws ON ws.id = mr.submissionId WHERE ws.companyId = ? AND ws.reviewNotes LIKE ?",
      [companyId, `%${DEMO_MARKER}%`]
    );
    await connection.query(
      "DELETE FROM weekly_submissions WHERE companyId = ? AND reviewNotes LIKE ?",
      [companyId, `%${DEMO_MARKER}%`]
    );
    await connection.query(
      "DELETE kv FROM kpi_values kv JOIN kpi_submissions ks ON ks.id = kv.submissionId WHERE ks.companyId = ?",
      [companyId]
    );
    await connection.query(
      "DELETE kc FROM kpi_submission_changes kc JOIN kpi_submissions ks ON ks.id = kc.submissionId WHERE ks.companyId = ?",
      [companyId]
    );
    await connection.query("DELETE FROM kpi_submissions WHERE companyId = ?", [
      companyId,
    ]);
    await connection.query(
      "DELETE FROM project_companies WHERE companyId = ?",
      [companyId]
    );
    await connection.query("DELETE FROM companies WHERE id = ?", [companyId]);
  }

  await connection.query(
    "DELETE FROM waste_egars WHERE egarId LIKE 'DEMO-STAND-%'"
  );
  const [plans] = await connection.query(
    "SELECT id FROM monitoring_plans WHERE notes LIKE ?",
    [`%${DEMO_MARKER}%`]
  );
  const planIds = plans.map(plan => Number(plan.id));
  if (planIds.length) {
    const placeholders = planIds.map(() => "?").join(",");
    await connection.query(
      `DELETE FROM monitoring_plan_attachments WHERE planId IN (${placeholders})`,
      planIds
    );
    await connection.query(
      `DELETE FROM monitoring_plan_updates WHERE planId IN (${placeholders})`,
      planIds
    );
    await connection.query(
      `DELETE FROM monitoring_plan_assignments WHERE planId IN (${placeholders})`,
      planIds
    );
    await connection.query(
      `DELETE FROM monitoring_plans WHERE id IN (${placeholders})`,
      planIds
    );
  }

  const [events] = await connection.query(
    "SELECT id FROM calendar_events WHERE sourceKey LIKE ?",
    [`${DEMO_SOURCE_PREFIX}%`]
  );
  const eventIds = events.map(event => Number(event.id));
  if (eventIds.length) {
    const placeholders = eventIds.map(() => "?").join(",");
    const [cycles] = await connection.query(
      `SELECT id FROM apa_reporting_cycles WHERE calendarEventId IN (${placeholders})`,
      eventIds
    );
    const cycleIds = cycles.map(cycle => Number(cycle.id));
    if (cycleIds.length) {
      await connection.query(
        `DELETE FROM apa_reporting_cycle_plans WHERE cycleId IN (${cycleIds.map(() => "?").join(",")})`,
        cycleIds
      );
    }
    await connection.query(
      `DELETE FROM apa_reporting_cycles WHERE calendarEventId IN (${placeholders})`,
      eventIds
    );
    await connection.query(
      `DELETE FROM calendar_events WHERE id IN (${placeholders})`,
      eventIds
    );
  }
}

async function seedPlatformDemonstration(connection, projectId, userId, now) {
  const [companyResult] = await connection.query(
    "INSERT INTO companies (name, shortName, companyType, active) VALUES (?, ?, 'ee', 1)",
    ["Demonstração STAND — Entidade Executante", DEMO_COMPANY_SHORT_NAME]
  );
  const companyId = Number(companyResult.insertId);
  const current = isoWeek(noonUtc(now));
  await connection.query(
    "INSERT INTO project_companies (projectId, companyId, startWeek, startYear, bufferWeeks) VALUES (?, ?, ?, ?, 0)",
    [projectId, companyId, Math.max(1, current.week - 8), current.year]
  );

  const [measures] = await connection.query(
    "SELECT id, number, description FROM measures WHERE projectId = ? AND number REGEXP '^[0-9]+(\\\\.[0-9]+)?$' ORDER BY CAST(number AS DECIMAL(12,2)), id LIMIT 8",
    [projectId]
  );
  if (!measures.length)
    throw new Error(
      "Não existem medidas semanais numéricas no SIN02 para criar demonstração."
    );

  let submissions = 0;
  const weeklyStart = noonUtc(
    new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 56)
    )
  );
  for (let index = 0; index < 8; index += 1) {
    const weekStart = weeklyStart + index * 7 * DAY;
    const week = isoWeek(weekStart);
    const weekEnd = weekStart + 6 * DAY;
    const [submissionResult] = await connection.query(
      `INSERT INTO weekly_submissions (companyId, projectId, weekNumber, weekYear, weekStartDate, weekEndDate, status, submittedBy, createdBy, submittedAt, reviewedBy, reviewedAt, reviewNotes)
       VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        projectId,
        week.week,
        week.year,
        asDate(weekStart),
        asDate(weekEnd),
        userId,
        userId,
        weekEnd,
        userId,
        weekEnd + DAY,
        `${DEMO_MARKER} Ficha aprovada para demonstração e ensaio do RDCD.`,
      ]
    );
    const submissionId = Number(submissionResult.insertId);
    submissions += 1;
    const responseRows = measures
      .slice(0, 6)
      .map((measure, measureIndex) => [
        submissionId,
        Number(measure.id),
        measureIndex === 4 && index === 5 ? "I" : "C",
        `${DEMO_MARKER} Semana ${week.week}/${week.year}: verificação em obra e evidência de acompanhamento para a medida ${measure.number}.`,
      ]);
    await connection.query(
      `INSERT INTO measure_responses (submissionId, measureId, status, observations) VALUES ${responseRows.map(() => "(?,?,?,?)").join(",")}`,
      responseRows.flat()
    );
  }

  const [metrics] = await connection.query(
    "SELECT id FROM kpi_metrics WHERE active = 1 ORDER BY sortOrder, id LIMIT 6"
  );
  let kpiSubmissions = 0;
  for (let index = 0; index < 8; index += 1) {
    const at = weeklyStart + index * 7 * DAY;
    const week = isoWeek(at);
    const [kpiResult] = await connection.query(
      "INSERT INTO kpi_submissions (projectId, companyId, sourceType, userId, weekNumber, weekYear, status) VALUES (?, ?, 'ee', ?, ?, ?, 'submitted')",
      [projectId, companyId, userId, week.week, week.year]
    );
    const submissionId = Number(kpiResult.insertId);
    kpiSubmissions += 1;
    if (metrics.length) {
      const valueRows = metrics.map((metric, metricIndex) => [
        submissionId,
        Number(metric.id),
        String(18 + index * 3 + metricIndex * 7),
      ]);
      await connection.query(
        `INSERT INTO kpi_values (submissionId, metricId, value) VALUES ${valueRows.map(() => "(?,?,?)").join(",")}`,
        valueRows.flat()
      );
    }
    await connection.query(
      "INSERT INTO kpi_submission_changes (submissionId, action, actorId, actorName, summary, changedValues) VALUES (?, 'demo_seed', ?, 'STAND Demo', ?, ?)",
      [
        submissionId,
        userId,
        `${DEMO_MARKER} Indicadores preenchidos para teste de fluxos.`,
        JSON.stringify({ source: "seed-demo", demo: true }),
      ]
    );
  }

  const egarRows = [];
  for (let index = 0; index < 12; index += 1) {
    const at = weeklyStart + index * 4 * DAY;
    const date = new Date(at);
    egarRows.push([
      projectId,
      companyId,
      at,
      `DEMO-STAND-${date.getUTCFullYear()}-${String(index + 1).padStart(3, "0")}`,
      "Demonstração STAND",
      index % 2 ? "17 09 04" : "17 09 03",
      index % 2 ? "Resíduos de construção e demolição mistos" : "Madeira",
      String(round(1.2 + index * 0.18, 2)),
      index % 3 === 0 ? "incinerated" : "recycled",
      date.getUTCMonth() + 1,
      date.getUTCFullYear(),
      userId,
    ]);
  }
  await connection.query(
    `INSERT INTO waste_egars (projectId, companyId, date, egarId, operator, lerCode, designation, quantity, destination, month, year, createdBy)
     VALUES ${egarRows.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?)").join(",")}`,
    egarRows.flat()
  );

  const receivedAt = addDays(noonUtc(now), -21);
  const annualReceivedAt = addDays(noonUtc(now), -48);
  const planDefinitions = [
    [
      "DEMO-P01",
      "Programa de monitorização da qualidade da água",
      "programa_monitorizacao",
      "Trimestral",
      "em_curso",
      "rdcd",
    ],
    [
      "DEMO-P02",
      "Programa de monitorização de resíduos e circularidade",
      "programa_monitorizacao",
      "Mensal",
      "em_validacao",
      "rdcd",
    ],
    [
      "DEMO-P03",
      "Programa de monitorização de ruído e vibrações",
      "programa_monitorizacao",
      "Trimestral",
      "em_curso",
      "rdcd",
    ],
    [
      "DEMO-P04",
      "Plano de gestão de solos e materiais",
      "plano_projeto",
      "Semestral",
      "em_curso",
      "rdcd",
    ],
    [
      "DEMO-P05",
      "Plano de biodiversidade e recuperação ecológica",
      "plano_projeto",
      "Anual",
      "nao_iniciado",
      "relatorio_anual_dcape",
    ],
    [
      "DEMO-P06",
      "Plano de comunicação ambiental",
      "plano_projeto",
      "Anual",
      "bloqueado",
      "relatorio_anual_dcape",
    ],
  ];
  const planIds = [];
  for (let index = 0; index < planDefinitions.length; index += 1) {
    const [
      planNumber,
      name,
      category,
      periodicity,
      trackingStatus,
      apaReportType,
    ] = planDefinitions[index];
    const receipt = index < 4 ? receivedAt : annualReceivedAt;
    const [planResult] = await connection.query(
      `INSERT INTO monitoring_plans (planNumber, name, category, periodicity, phase, ownerId, ownerName, supportName, trackingStatus, lastReportingDate, nextReportingDate, apaReceivedAt, apaSubmissionDueAt, apaReportType, notes, submissionStatus, active)
       VALUES (?, ?, ?, ?, 'construcao', ?, 'STAND Demo', 'Equipa de sustentabilidade', ?, ?, ?, ?, ?, ?, ?, 'pending', 1)`,
      [
        planNumber,
        name,
        category,
        periodicity,
        userId,
        trackingStatus,
        addDays(receipt, -35),
        addDays(receipt, 28 + index * 3),
        receipt,
        addCivilMonths(receipt, 3),
        apaReportType,
        `${DEMO_MARKER} Plano demonstrativo para validar calendário, agrupamento RDCD e alertas APA.`,
      ]
    );
    const planId = Number(planResult.insertId);
    planIds.push(planId);
    await connection.query(
      "INSERT INTO monitoring_plan_updates (planId, status, updateText, createdBy, createdByName) VALUES (?, ?, ?, ?, 'STAND Demo')",
      [
        planId,
        trackingStatus,
        `${DEMO_MARKER} Atualização demonstrativa: planeamento, recolha de evidência e preparação do reporte à APA.`,
        userId,
      ]
    );
  }

  const eventDefinitions = [
    [
      "DEMO — RDCD SIN02",
      "RDCD",
      "Semestral",
      addDays(noonUtc(now), -30),
      "rdcd",
    ],
    [
      "DEMO — Relatório anual DCAPE SIN02",
      "Relatório anual DCAPE",
      "Anual",
      addDays(noonUtc(now), -56),
      "relatorio_anual_dcape",
    ],
    [
      "DEMO — Janela sem comunicação APA",
      "Janela de planeamento",
      "Trimestral",
      addDays(noonUtc(now), 38),
      "outro",
    ],
  ];
  const eventIds = [];
  for (let index = 0; index < eventDefinitions.length; index += 1) {
    const [name, category, periodicity, firstDate, reportType] =
      eventDefinitions[index];
    const [eventResult] = await connection.query(
      `INSERT INTO calendar_events (projectId, name, description, periodicity, firstDate, nextDate, category, status, ownerId, ownerName, sourceType, sourceKey, entityToDeliver, active, createdBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'STAND Demo', 'demo_seed', ?, 'APA', 1, ?)`,
      [
        projectId,
        name,
        `${DEMO_MARKER} Evento de teste que pode ser removido integralmente.`,
        periodicity,
        firstDate,
        firstDate,
        category,
        userId,
        `${DEMO_SOURCE_PREFIX}${reportType}:${index + 1}`,
        userId,
      ]
    );
    eventIds.push({ id: Number(eventResult.insertId), firstDate, reportType });
  }
  for (let index = 0; index < 2; index += 1) {
    const event = eventIds[index];
    const receipt = index === 0 ? receivedAt : annualReceivedAt;
    const [cycleResult] = await connection.query(
      `INSERT INTO apa_reporting_cycles (calendarEventId, occurrenceAt, projectId, reportType, receivedAt, submissionDueAt, createdBy, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.firstDate,
        projectId,
        event.reportType,
        receipt,
        addCivilMonths(receipt, 3),
        userId,
        userId,
      ]
    );
    const scope = index === 0 ? planIds.slice(0, 4) : planIds.slice(4);
    if (scope.length) {
      const links = scope.map(planId => [
        Number(cycleResult.insertId),
        planId,
        userId,
      ]);
      await connection.query(
        `INSERT INTO apa_reporting_cycle_plans (cycleId, planId, addedBy) VALUES ${links.map(() => "(?,?,?)").join(",")}`,
        links.flat()
      );
    }
  }

  return {
    submissions,
    kpiSubmissions,
    egars: egarRows.length,
    plans: planIds.length,
    calendarEvents: eventIds.length,
  };
}

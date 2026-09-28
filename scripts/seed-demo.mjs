#!/usr/bin/env node
/**
 * Dados demonstrativos reversíveis para o cockpit Operação (SIN01/NEST).
 * Todos os registos criados têm isDemo=1 e podem ser removidos com
 * `pnpm seed:demo -- --remove`; não toca em leituras, faturas ou cenários reais.
 */
import mysql from "mysql2/promise";

const removeOnly = process.argv.includes("--remove");
const DAY = 86_400_000;
const quarter = 15 * 60_000;
const now = new Date();
const noonUtc = (date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12);
const asDate = (time) => new Date(time).toISOString().slice(0, 10);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round = (value, digits = 3) => Number(value.toFixed(digits));

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [[project]] = await connection.query("SELECT id FROM projects WHERE code = 'SIN01' LIMIT 1");
  if (!project) throw new Error("Projeto SIN01 não encontrado.");
  const [[actor]] = await connection.query("SELECT id FROM users WHERE role = 'admin' AND accountStatus = 'active' ORDER BY id ASC LIMIT 1");
  if (!actor) throw new Error("É necessária uma conta administrativa ativa para criar os dados de demonstração.");
  const projectId = Number(project.id);
  const userId = Number(actor.id);

  await connection.beginTransaction();
  // A ordem evita referências pendentes e mantém todos os dados reais intactos.
  await connection.query("DELETE FROM operation_readings WHERE projectId = ? AND isDemo = 1", [projectId]);
  await connection.query("DELETE FROM operation_import_batches WHERE projectId = ? AND isDemo = 1", [projectId]);
  await connection.query("DELETE FROM operation_invoices WHERE projectId = ? AND isDemo = 1", [projectId]);
  await connection.query("DELETE FROM operation_scenarios WHERE projectId = ? AND isDemo = 1", [projectId]);
  await connection.query("DELETE FROM operation_sustainability_snapshots WHERE projectId = ? AND isDemo = 1", [projectId]);
  await connection.query("DELETE FROM operation_chemical_inventory WHERE projectId = ? AND isDemo = 1", [projectId]);

  if (removeOnly) {
    await connection.commit();
    console.log(`Dados de demonstração removidos do SIN01 (projeto ${projectId}).`);
    process.exit(0);
  }

  const [batchResult] = await connection.query(
    `INSERT INTO operation_import_batches (projectId, sourceFilename, sourceFileKey, sourceFileUrl, sourceType, measuredDate, rowsImported, qualityStatus, qualityNotes, isDemo, importedBy)
     VALUES (?, 'DEMO_BMS_NEST_2026.xlsx', 'demo/sin01/bms-2026.xlsx', 'demo://sin01/bms-2026', 'bms_extract', ?, 0, 'warning', 'Demonstração: inclui lacunas e três leituras fora do limite para testar a qualidade.', 1, ?)`,
    [projectId, asDate(now.getTime()), userId],
  );
  const batchId = Number(batchResult.insertId);
  const readings = [];
  // A origem manual identifica explicitamente a demonstração e evita colidir com
  // uma leitura BMS real que possa existir no mesmo instante.
  const add = (code, label, category, unit, value, at, granularity, quality = "valid", note = null) => readings.push([projectId, batchId, code, label, category, unit, String(round(value)), at, granularity, "manual", quality, note, 1]);

  // 12 meses diários: crescimento progressivo de carga e sazonalidade realista
  // da captação marítima. Alguns dias são sinalizados para testar alertas.
  const dailyStart = Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate() + 1);
  for (let index = 0; index < 365; index += 1) {
    const at = dailyStart + index * DAY;
    const seasonal = Math.sin((index / 365) * Math.PI * 2 - 0.7);
    const load = 7_100 + index * 3.9 + 340 * Math.sin(index / 17);
    const sea = 15.8 + seasonal * 3.8;
    const pue = 1.19 + seasonal * 0.035 + (index % 29 === 0 ? 0.02 : 0);
    const flow = 480 + seasonal * 28 + (load - 7100) / 110;
    const delta = 5.2 + seasonal * 0.35;
    const dailyQuality = [81, 193, 327].includes(index) ? "warning" : "valid";
    const note = dailyQuality === "warning" ? "Demonstração: excedência de teste para validação de alertas." : null;
    add("site_energy_kwh_daily", "Energia total do site", "energia", "kWh", load * pue * 24, at, "diario", dailyQuality, note);
    add("it_energy_kwh_daily", "Energia TI", "energia", "kWh", load * 24, at, "diario", dailyQuality, note);
    add("it_power_avg_kw", "Carga TI média", "energia", "kW", load, at, "diario", dailyQuality, note);
    add("pue", "PUE diário", "energia", "rácio", pue, at, "diario", dailyQuality, note);
    add("wue_reportado", "WUE reportado", "agua", "L/kWh TI", 0.22 + seasonal * 0.028, at, "diario", dailyQuality, note);
    add("seawater_intake_temp_c", "Temperatura de captação", "arrefecimento", "°C", sea, at, "diario", dailyQuality, note);
    add("seawater_return_temp_c", "Temperatura de descarga", "arrefecimento", "°C", sea + delta, at, "diario", dailyQuality, note);
    add("seawater_delta_t_k", "Delta T água do mar", "arrefecimento", "K", delta, at, "diario", dailyQuality, note);
    add("seawater_flow_lps", "Caudal de água do mar", "agua", "L/s", flow, at, "diario", dailyQuality, note);
    add("seawater_pumping_cop", "COP de bombagem", "arrefecimento", "rácio", 10.8 - seasonal * 0.5, at, "diario", dailyQuality, note);
    add("heat_exchanger_approach_k", "Approach permutador", "arrefecimento", "K", 1.8 + seasonal * 0.22, at, "diario", dailyQuality, note);
  }

  // Últimos 10 dias a 15 minutos: o cockpit obtém resolução suficiente para
  // correlações sem descarregar uma massa de dados que prejudique a interface.
  const qStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 9);
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
      const warning = (day === 4 && slot === 68) || (day === 17 && slot === 75) || (day === 26 && slot === 61);
      const state = invalid ? "invalid" : warning ? "warning" : "valid";
      const note = invalid ? "Demonstração: falha de sonda, excluir da análise." : warning ? "Demonstração: valor acima do limite configurado." : null;
      add("it_power_15m_kw", "Carga TI", "energia", "kW", load, at, "quinze_minutos", state, note);
      add("pue_15m", "PUE", "energia", "rácio", warning ? pue + 0.07 : pue, at, "quinze_minutos", state, note);
      add("wue_15m", "WUE", "agua", "L/kWh TI", 0.235 + profile * 0.012 + seasonal * 0.015, at, "quinze_minutos", state, note);
      add("cooling_cycles_15m", "Ciclos de arrefecimento", "arrefecimento", "ciclos", 3.2 + profile * 0.55 + seasonal * 0.25, at, "quinze_minutos", state, note);
      add("seawater_intake_15m_c", "Temperatura de captação", "arrefecimento", "°C", sea, at, "quinze_minutos", state, note);
    }
  }

  for (let offset = 0; offset < readings.length; offset += 750) {
    const chunk = readings.slice(offset, offset + 750);
    await connection.query(
      `INSERT INTO operation_readings (projectId, batchId, metricCode, metricLabel, category, unit, value, measuredAt, granularity, source, dataQuality, qualityNote, isDemo)
       VALUES ${chunk.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",")}`,
      chunk.flat(),
    );
  }
  await connection.query("UPDATE operation_import_batches SET rowsImported = ? WHERE id = ?", [readings.length, batchId]);

  const invoiceRows = [];
  for (let month = 0; month < 12; month += 1) {
    const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - month, 1));
    const start = asDate(period.getTime());
    const end = asDate(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 0));
    invoiceRows.push([projectId, "electricidade", "Fornecedor Energia Demo", `DEMO-EL-${start.slice(0, 7)}`, start, end, String(6_550_000 + month * 14_000), "kWh", String(655_000 + month * 1_500), "EUR", "conforme", "Demonstração", 1, userId]);
    invoiceRows.push([projectId, "agua_industrial", "Água Industrial Demo", `DEMO-H2O-${start.slice(0, 7)}`, start, end, String(4_600 + month * 25), "m3", String(9_800 + month * 80), "EUR", month === 3 ? "desvio" : "conforme", "Demonstração", 1, userId]);
  }
  await connection.query(`INSERT INTO operation_invoices (projectId, invoiceType, supplier, invoiceNumber, periodStart, periodEnd, quantity, unit, totalCost, currency, reconciliationStatus, notes, isDemo, createdBy) VALUES ${invoiceRows.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").join(",")}`, invoiceRows.flat());
  await connection.query("INSERT INTO operation_sustainability_snapshots (projectId, recordedAt, hvoLiters, dieselLiters, absoluteCo2Tonnes, notes, isDemo, createdBy) VALUES (?, ?, ?, ?, ?, ?, 1, ?)", [projectId, asDate(now.getTime()), "18200", "2400", "7.4", "Demonstração: inventário de combustível e emissões operacionais.", userId]);
  await connection.query("INSERT INTO operation_chemical_inventory (projectId, chemicalName, quantity, unit, safetyThreshold, location, notes, isDemo, updatedBy) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?), (?, ?, ?, ?, ?, ?, ?, 1, ?)", [projectId, "Biocida anti-fouling", "420", "L", "500", "Captação água do mar", "Demonstração: abaixo do nível mínimo para testar alerta.", userId, projectId, "Inibidor de corrosão", "1180", "L", "650", "Sala de tratamento", "Demonstração", userId]);
  const assumptions = JSON.stringify({ tiEnergyKwh: 6_500_000, baselinePue: 1.24, baselineWaterM3: 4600, baselineMaintenanceEur: 78000, electricityPriceEurKwh: 0.1, waterPriceEurM3: 2.1, carbonFactorKgKwh: 0.28, targetPue: 1.18, targetWueLkwh: 0.24, maintenanceEur: 82000, systemMix: { agua_mar: 100, chiller: 0, hibrido_adiabatico: 0 } });
  await connection.query("INSERT INTO operation_scenarios (projectId, name, coolingStrategy, assumptionsJson, resultJson, baselineStart, baselineEnd, isDemo, createdBy) VALUES (?, ?, 'agua_mar', ?, ?, ?, ?, 1, ?)", [projectId, "Demonstração — otimização de caudal", assumptions, JSON.stringify({}), asDate(qStart), asDate(now.getTime()), userId]);
  await connection.commit();
  console.log(`Criados ${readings.length} leituras, ${invoiceRows.length} faturas e inventários demonstrativos no SIN01. Todos os registos foram marcados isDemo=1.`);
} catch (error) {
  await connection.rollback();
  console.error(error);
  process.exitCode = 1;
} finally {
  await connection.end();
}

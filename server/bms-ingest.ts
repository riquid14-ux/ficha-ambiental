import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import * as db from "./db";
import * as schema from "../drizzle/schema";
import { ENV } from "./_core/env";

const BMS_PROJECT_CODE = "SIN01";
const BMS_MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const METRIC_CATALOG = {
  site_power_15m_kw: { label: "Potência do site", category: "energia", unit: "kW", granularities: ["quinze_minutos"] },
  it_power_15m_kw: { label: "Carga TI", category: "energia", unit: "kW", granularities: ["quinze_minutos"] },
  pue_15m: { label: "PUE", category: "energia", unit: "rácio", granularities: ["quinze_minutos"] },
  cooling_cycles_15m: { label: "Ciclos de arrefecimento", category: "arrefecimento", unit: "N.º", granularities: ["quinze_minutos"] },
  seawater_flow_15m_lps: { label: "Caudal de água do mar", category: "agua", unit: "L/s", granularities: ["quinze_minutos"] },
  seawater_intake_temp_15m_c: { label: "Temperatura de captação", category: "arrefecimento", unit: "°C", granularities: ["quinze_minutos"] },
  wue_15m: { label: "WUE", category: "agua", unit: "L/kWh TI", granularities: ["quinze_minutos"] },
  site_energy_kwh_daily: { label: "Energia diária do site", category: "energia", unit: "kWh", granularities: ["diario"] },
  it_energy_kwh_daily: { label: "Energia TI diária", category: "energia", unit: "kWh", granularities: ["diario"] },
  pue: { label: "PUE", category: "energia", unit: "rácio", granularities: ["diario"] },
  seawater_flow_lps: { label: "Caudal de água do mar", category: "agua", unit: "L/s", granularities: ["diario"] },
  seawater_intake_temp_c: { label: "Temperatura de captação", category: "arrefecimento", unit: "°C", granularities: ["diario"] },
  seawater_return_temp_c: { label: "Temperatura de descarga", category: "arrefecimento", unit: "°C", granularities: ["diario"] },
  seawater_pumping_cop: { label: "COP de bombagem", category: "arrefecimento", unit: "térmico/elétrico", granularities: ["diario"] },
  wue_reportado: { label: "WUE reportado", category: "agua", unit: "L/kWh TI", granularities: ["diario"] },
} as const;

type BmsMetricCode = keyof typeof METRIC_CATALOG;
type BmsGranularity = "quinze_minutos" | "diario";

const bmsPayloadSchema = z.object({
  eventId: z.string().trim().min(8).max(120).regex(/^[A-Za-z0-9._:-]+$/),
  projectCode: z.literal(BMS_PROJECT_CODE),
  measuredAt: z.string().trim().min(20).max(40),
  readings: z.array(z.object({
    metricCode: z.enum(Object.keys(METRIC_CATALOG) as [BmsMetricCode, ...BmsMetricCode[]]),
    value: z.number().finite().min(0).max(1_000_000_000),
    granularity: z.enum(["quinze_minutos", "diario"]),
    dataQuality: z.enum(["valid", "warning"]).default("valid"),
    qualityNote: z.string().trim().max(500).optional(),
  })).min(1).max(500),
});

export type BmsIngestPayload = z.infer<typeof bmsPayloadSchema>;

export function createBmsSignature(secret: string, timestamp: string, rawBody: string | Buffer) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.`).update(rawBody).digest("hex");
}

export function verifyBmsSignature({ secret, timestamp, rawBody, signature, now = Date.now() }: { secret: string; timestamp: string | undefined; rawBody: string | Buffer; signature: string | undefined; now?: number }) {
  if (!secret || !timestamp || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const sentAt = Date.parse(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > BMS_MAX_CLOCK_SKEW_MS) return false;
  const expected = createBmsSignature(secret, timestamp, rawBody);
  const supplied = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return supplied.length === expectedBuffer.length && crypto.timingSafeEqual(supplied, expectedBuffer);
}

export function normalizeBmsPayload(value: unknown) {
  const payload = bmsPayloadSchema.parse(value);
  const measuredAt = Date.parse(payload.measuredAt);
  if (!Number.isFinite(measuredAt)) throw new Error("A data de medição BMS é inválida.");
  if (measuredAt > Date.now() + BMS_MAX_CLOCK_SKEW_MS || measuredAt < Date.now() - 366 * 24 * 60 * 60 * 1000) {
    throw new Error("A data de medição BMS está fora da janela permitida.");
  }
  const metricCodes = new Set<string>();
  const readings = payload.readings.map(reading => {
    const descriptor = METRIC_CATALOG[reading.metricCode];
    if (!(descriptor.granularities as readonly BmsGranularity[]).includes(reading.granularity)) {
      throw new Error(`A granularidade não é permitida para ${reading.metricCode}.`);
    }
    const id = `${reading.metricCode}:${reading.granularity}`;
    if (metricCodes.has(id)) throw new Error("O evento BMS contém uma métrica duplicada.");
    metricCodes.add(id);
    return { ...reading, ...descriptor };
  });
  return { ...payload, measuredAt, readings };
}

type RawBodyRequest = Request & { rawBody?: Buffer };

function deny(res: Response, status: number, error: string) {
  return res.status(status).json({ accepted: false, error });
}

/**
 * Recebe telemetria de um gateway Start Campus que inicia a ligação a partir da
 * rede BMS. Não é um conector de polling: não há credenciais BMS no browser,
 * nem a aplicação abre acesso à rede OT. A rota fica inativa sem os segredos
 * e a identidade técnica configurados pelo IT.
 */
export function registerBmsIngestRoutes(app: Express) {
  app.post("/api/integrations/bms/v1/readings", async (req: RawBodyRequest, res: Response) => {
    if (!ENV.bmsIngestHmacSecret || !ENV.bmsServiceUserId) {
      return deny(res, 503, "A integração BMS não está configurada.");
    }

    const rawBody = req.rawBody;
    const timestamp = req.header("x-bms-timestamp") || undefined;
    const signature = req.header("x-bms-signature") || undefined;
    if (!rawBody || !verifyBmsSignature({ secret: ENV.bmsIngestHmacSecret, timestamp, rawBody, signature })) {
      return deny(res, 401, "Pedido BMS não autenticado.");
    }

    let payload: ReturnType<typeof normalizeBmsPayload>;
    try {
      payload = normalizeBmsPayload(req.body);
    } catch (error) {
      return deny(res, 400, error instanceof Error ? error.message : "Carga BMS inválida.");
    }

    try {
      const database = await db.getDb();
      if (!database) return deny(res, 503, "Base de dados indisponível.");
      const projectResult = await database.execute(sql`SELECT id, code FROM projects WHERE code = ${BMS_PROJECT_CODE} LIMIT 1`);
      const project = (projectResult as any)[0]?.[0];
      if (!project) return deny(res, 503, "Projeto operacional indisponível.");
      const projectId = Number(project.id);
      const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
      let duplicate = false;

      await database.transaction(async (tx: any) => {
        const existing = await tx.execute(sql`SELECT id FROM operation_bms_events WHERE projectId = ${projectId} AND eventId = ${payload.eventId} LIMIT 1`);
        if ((existing as any)[0]?.[0]) {
          duplicate = true;
          return;
        }
        const sourceName = `bms-${payload.eventId}`.slice(0, 255);
        const qualityStatus = payload.readings.some(reading => reading.dataQuality === "warning") ? "warning" : "valid";
        const [batch] = await tx.insert(schema.operationImportBatches).values({
          projectId,
          sourceFilename: sourceName,
          sourceFileKey: `bms://${BMS_PROJECT_CODE}/${payload.eventId}`,
          sourceFileUrl: "bms://gateway/signed-event",
          sourceType: "bms_extract",
          measuredDate: new Date(payload.measuredAt).toISOString().slice(0, 10),
          rowsImported: payload.readings.length,
          qualityStatus,
          qualityNotes: "Evento BMS assinado e aceite pela lista de métricas autorizadas.",
          importedBy: ENV.bmsServiceUserId,
        }).$returningId();
        await tx.insert(schema.operationBmsEvents).values({
          projectId,
          eventId: payload.eventId,
          payloadHash: bodyHash,
          batchId: Number(batch.id),
          receivedAt: Date.now(),
        });
        for (const reading of payload.readings) {
          await tx.execute(sql`
            INSERT INTO operation_readings (projectId, batchId, metricCode, metricLabel, category, unit, value, measuredAt, granularity, source, dataQuality, qualityNote)
            VALUES (${projectId}, ${batch.id}, ${reading.metricCode}, ${reading.label}, ${reading.category}, ${reading.unit}, ${String(reading.value)}, ${payload.measuredAt}, ${reading.granularity}, 'bms_report', ${reading.dataQuality}, ${reading.qualityNote || 'Recebido do gateway BMS autenticado.'})
            ON DUPLICATE KEY UPDATE batchId = VALUES(batchId), value = VALUES(value), dataQuality = VALUES(dataQuality), qualityNote = VALUES(qualityNote)
          `);
        }
      });

      if (duplicate) return res.status(202).json({ accepted: true, duplicate: true, eventId: payload.eventId });
      await db.insertAuditLog(ENV.bmsServiceUserId, "BMS gateway", "operation_bms_ingest", "operation_bms_event", projectId, null, JSON.stringify({ eventId: payload.eventId, measuredAt: payload.measuredAt, readings: payload.readings.map(reading => ({ metricCode: reading.metricCode, granularity: reading.granularity, dataQuality: reading.dataQuality })) }));
      return res.status(202).json({ accepted: true, duplicate: false, eventId: payload.eventId, readingsAccepted: payload.readings.length });
    } catch (error) {
      console.error("[BMS] Signed event processing failed", error);
      return deny(res, 503, "Não foi possível processar o evento BMS.");
    }
  });
}

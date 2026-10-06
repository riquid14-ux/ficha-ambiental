import { describe, expect, it } from "vitest";
import { createBmsSignature, normalizeBmsPayload, verifyBmsSignature } from "./bms-ingest";

const payload = {
  eventId: "nest-20261006-001",
  projectCode: "SIN01" as const,
  measuredAt: new Date().toISOString(),
  readings: [
    { metricCode: "it_power_15m_kw" as const, value: 1200, granularity: "quinze_minutos" as const, dataQuality: "valid" as const },
    { metricCode: "pue_15m" as const, value: 1.18, granularity: "quinze_minutos" as const, dataQuality: "warning" as const },
  ],
};

describe("Integração BMS assinada", () => {
  it("valida assinatura HMAC com janela temporal limitada", () => {
    const secret = "test-secret";
    const timestamp = new Date().toISOString();
    const rawBody = JSON.stringify(payload);
    const signature = createBmsSignature(secret, timestamp, rawBody);
    expect(verifyBmsSignature({ secret, timestamp, rawBody, signature })).toBe(true);
    const invalidSignature = `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`;
    expect(verifyBmsSignature({ secret, timestamp, rawBody, signature: invalidSignature })).toBe(false);
    expect(verifyBmsSignature({ secret, timestamp: "2020-01-01T00:00:00.000Z", rawBody, signature })).toBe(false);
  });

  it("aceita apenas métricas canónicas, granularidade compatível e um evento sem duplicados", () => {
    const normalized = normalizeBmsPayload(payload);
    expect(normalized.readings).toEqual(expect.arrayContaining([
      expect.objectContaining({ metricCode: "it_power_15m_kw", label: "Carga TI", unit: "kW" }),
      expect.objectContaining({ metricCode: "pue_15m", label: "PUE", dataQuality: "warning" }),
    ]));
    expect(() => normalizeBmsPayload({ ...payload, readings: [{ metricCode: "pue_15m", value: 1.1, granularity: "diario" }] })).toThrow("granularidade");
    expect(() => normalizeBmsPayload({ ...payload, readings: [payload.readings[0], payload.readings[0]] })).toThrow("duplicada");
  });

  it("rejeita telemetria fora da janela de retenção da receção", () => {
    expect(() => normalizeBmsPayload({ ...payload, measuredAt: "2020-01-01T00:00:00.000Z" })).toThrow("fora da janela");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const guide = readFileSync(resolve(import.meta.dirname, "../docs/GUIA_PRATICO_FASE_1_START_CAMPUS.md"), "utf8");

describe("guia prático de implementação", () => {
  it("cobre todos os componentes da arquitetura de Fase 1 sem valores secretos", () => {
    for (const component of ["HAProxy", "BunkerWeb", "MariaDB Galera", "Synology", "Valkey", "Office 365", "ACC", "BMS"]) {
      expect(guide).toContain(component);
    }
    expect(guide).toContain("RmdRicardo <rmd@startcampus.pt>");
    expect(guide).toContain("não deve receber segredos");
    expect(guide).toContain("Testes obrigatórios de aceitação");
  });
});

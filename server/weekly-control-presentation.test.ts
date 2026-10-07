import { describe, expect, it } from "vitest";
import {
  cleanWeeklyControlDescription,
  localizeWeeklyControlDescription,
  localizeWeeklyControlSectionName,
} from "../client/src/lib/weekly-control-presentation";

describe("weekly control presentation", () => {
  const legacyDescription =
    "Medida DCAPE - Cintagem prévia, com tinta indelével, dos sobreiros a abater.";

  it("removes the regulatory prefix from the weekly control wording", () => {
    expect(cleanWeeklyControlDescription(legacyDescription)).toBe(
      "Cintagem prévia, com tinta indelével, dos sobreiros a abater."
    );
    expect(cleanWeeklyControlDescription("DCAPE measure - Test measure.")).toBe(
      "Test measure."
    );
  });

  it("keeps the weekly presentation independent in Portuguese and English", () => {
    expect(localizeWeeklyControlDescription(legacyDescription, "pt")).not.toContain("DCAPE");
    expect(localizeWeeklyControlDescription(legacyDescription, "en")).not.toMatch(/DCAPE measure/i);
    expect(
      localizeWeeklyControlSectionName(
        "MEDIDAS DA DCAPE A CONSIDERAR NA FASE DE EXECUÇÃO DA OBRA",
        "pt"
      )
    ).toBe("Controlo semanal — execução da obra");
    expect(
      localizeWeeklyControlSectionName(
        "MEDIDAS DA DCAPE A CONSIDERAR NA FASE DE EXECUÇÃO DA OBRA",
        "en"
      )
    ).toBe("Weekly control — construction execution");
  });

  it("keeps the weekly UI away from lifecycle phase labels", async () => {
    const weeklyForm = await import("node:fs/promises").then(file =>
      file.readFile(`${process.cwd()}/client/src/pages/WeeklyForm.tsx`, "utf8")
    );
    const review = await import("node:fs/promises").then(file =>
      file.readFile(`${process.cwd()}/client/src/pages/ReviewPage.tsx`, "utf8")
    );
    expect(weeklyForm).toContain('String(sectionIndex + 1).padStart(2, "0")');
    expect(review).toContain('String(sectionIndex + 1).padStart(2, "0")');
    expect(weeklyForm).toContain('t("MEDIDAS")');
    expect(weeklyForm).toContain('t("Disponíveis nesta ficha")');
  });
});

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const output = execFileSync("node", ["scripts/extract-ui-literals.mjs"], { cwd: root, encoding: "utf8" });
const literals = JSON.parse(output).map((item) => item.text);
const mapSource = fs.readFileSync(path.join(root, "client/src/lib/ui-literal-translations.ts"), "utf8");
const marker = "export const uiLiteralTranslations: Record<string, string> = ";
const start = mapSource.indexOf(marker);
if (start < 0) throw new Error("Missing uiLiteralTranslations mapping");
const jsonStart = start + marker.length;
const jsonEnd = mapSource.lastIndexOf("\n};") + 2;
const dictionary = JSON.parse(mapSource.slice(jsonStart, jsonEnd));
const ignored = new Set([
  "· Art. 12.º da Diretiva (UE) 2023/1791. Aplica-se a centros de dados com potência TI ≥ 500 kW. Submissão anual à DGEG até 15 de maio.",
]);
const uncovered = literals.filter((literal) => !dictionary[literal] && !ignored.has(literal));
if (uncovered.length) {
  console.error("Uncovered static UI literals:\n" + uncovered.map((value) => `- ${value}`).join("\n"));
  process.exit(1);
}
console.log(`i18n coverage verified: ${literals.length} extracted literals; ${Object.keys(dictionary).length} mapped; ${ignored.size} regulatory source exclusion.`);

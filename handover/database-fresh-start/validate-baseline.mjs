#!/usr/bin/env node
/** Verifica que a baseline fresh start é apenas DDL e corresponde ao hash entregue. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(directory, "drizzle", "0000_stand_schema_baseline.sql");
const checksumPath = join(directory, "SCHEMA_BASELINE_SHA256.txt");
const sql = readFileSync(sqlPath, "utf8");
const expected = readFileSync(checksumPath, "utf8").trim().split(/\s+/)[0];
const actual = createHash("sha256").update(sql).digest("hex");
const tableCount = (sql.match(/^CREATE TABLE /gim) ?? []).length;
// `ON UPDATE CURRENT_TIMESTAMP` é um default legítimo da DDL; por isso a
// verificação só rejeita comandos de escrita/destrutivos no início de uma
// instrução SQL, e não meras palavras presentes numa definição de coluna.
const forbidden = /^\s*(?:INSERT|UPDATE|DELETE|REPLACE|DROP|ALTER|TRUNCATE|CREATE\s+USER|GRANT|REVOKE)\b/im;

if (actual !== expected) throw new Error("Falha de integridade: SHA-256 da baseline não corresponde ao manifesto.");
if (tableCount !== 59) throw new Error(`Baseline inesperada: ${tableCount} tabelas; eram esperadas 59.`);
if (forbidden.test(sql)) throw new Error("Baseline inválida: contém DML, DDL destrutivo, utilizadores ou permissões.");
if (!sql.includes("CREATE TABLE `users`")) throw new Error("Baseline inválida: tabela users ausente.");
if (!sql.includes("CREATE TABLE `operation_readings`")) throw new Error("Baseline inválida: tabela operation_readings ausente.");

console.log(`Baseline válida: ${tableCount} tabelas, apenas DDL, SHA-256 ${actual}.`);

#!/usr/bin/env node
/** Importa somente o catálogo-modelo SIN02 para uma base nova; não importa pessoas nem dados operacionais. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const directory = dirname(fileURLToPath(import.meta.url));
const template = JSON.parse(readFileSync(join(directory, "catalogue-template-SIN02.json"), "utf8"));
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ausente.");
if (template.format !== "stand-catalogue-template/v1" || template.project.code !== "SIN02") {
  throw new Error("Ficheiro de catálogo inválido.");
}
if (!Array.isArray(template.sections) || !Array.isArray(template.measures)) {
  throw new Error("Catálogo incompleto.");
}

const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await connection.beginTransaction();
  const [existingProject] = await connection.execute("SELECT id FROM projects WHERE code = 'SIN02' LIMIT 1");
  let projectId;
  if (existingProject.length) {
    projectId = Number(existingProject[0].id);
    const [existingCatalogue] = await connection.execute("SELECT COUNT(*) AS total FROM sections WHERE projectId = ?", [projectId]);
    if (Number(existingCatalogue[0].total) > 0) {
      throw new Error("SIN02 já tem catálogo. O importador não altera nem duplica catálogos existentes.");
    }
  } else {
    const [created] = await connection.execute(
      "INSERT INTO projects (code, name, description, enabledModules, active) VALUES (?, ?, ?, ?, 1)",
      [template.project.code, template.project.name, template.project.description, JSON.stringify(template.project.enabledModules)]
    );
    projectId = Number(created.insertId);
  }

  const sectionIds = new Map();
  for (const section of template.sections) {
    const [created] = await connection.execute(
      "INSERT INTO sections (projectId, catalogueScope, name, orderIndex, phase) VALUES (?, ?, ?, ?, ?)",
      [projectId, section.catalogueScope, section.name, section.orderIndex, section.phase]
    );
    sectionIds.set(section.key, Number(created.insertId));
  }
  for (const measure of template.measures) {
    const sectionId = sectionIds.get(measure.sectionKey);
    if (!sectionId) throw new Error(`Medida ${measure.number} sem secção associada.`);
    await connection.execute(
      "INSERT INTO measures (projectId, catalogueScope, number, description, responsible, sectionId, orderIndex) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [projectId, measure.catalogueScope, measure.number, measure.description, measure.responsible, sectionId, measure.orderIndex]
    );
  }
  await connection.commit();
  console.log(`Catálogo SIN02 importado: ${template.sections.length} secções e ${template.measures.length} medidas. Nenhum dado de pessoas, fichas ou evidências foi importado.`);
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}

#!/usr/bin/env node
/**
 * Primeira carga das fotografias institucionais no object storage corporativo.
 * Não lê nem escreve ficheiros da aplicação em client/public. Recebe um diretório
 * preparado pelo IT com os JPGs autorizados da marca Start Campus e envia-os para
 * as chaves que a STAND já resolve nas páginas autenticadas.
 *
 * Uso: node ops/migrate-brand-assets.mjs /secure/import/start-campus-brand
 */
import fs from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error("Uso: node ops/migrate-brand-assets.mjs <diretório-com-JPGs-autorizados>");

const required = ["S3_BUCKET", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`S3 corporativo incompleto: ${missing.join(", ")}`);

const assets = [
  ["start-campus-9.jpg", "start-campus-9_0e9ab8b0.jpg"],
  ["start-campus-17.jpg", "start-campus-17_de17c18d.jpg"],
  ["start-campus-10.jpg", "start-campus-10_f1d3919f.jpg"],
  ["start-campus-12.jpg", "start-campus-12_e458c914.jpg"],
  ["start-campus-13.jpg", "start-campus-13_c68ebb45.jpg"],
  ["start-campus-14.jpg", "start-campus-14_ed04207a.jpg"],
  ["start-campus-15.jpg", "start-campus-15_72f83746.jpg"],
  ["start-campus-11.jpg", "start-campus-11_fced6e75.jpg"],
  ["start-campus-4.jpg", "start-campus-4_9ce4d2bc.jpg"],
  ["start-campus-5.jpg", "start-campus-5_5d8e4400.jpg"],
  ["start-campus-8.jpg", "start-campus-8_1bdb1eb1.jpg"],
  ["start-campus-19.jpg", "start-campus-19_1fd1e617.jpg"],
  ["start-campus-6.jpg", "start-campus-6_49846847.jpg"],
  ["start-campus-18.jpg", "start-campus-18_9a4385f8.jpg"],
  ["start-campus-1.jpg", "start-campus-1_fdbe2fde.jpg"],
  ["start-campus-16.jpg", "start-campus-16_e7622842.jpg"],
  ["start-campus-2.jpg", "start-campus-2_23725165.jpg"],
  ["start-campus-7.jpg", "start-campus-7_9876e6c3.jpg"],
];

const client = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});

for (const [filename, key] of assets) {
  const input = path.join(sourceDirectory, filename);
  const content = await fs.readFile(input);
  if (content.length < 4_000) throw new Error(`Ficheiro inválido ou demasiado pequeno: ${filename}`);
  await client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: content,
    ContentType: "image/jpeg",
    CacheControl: "private, max-age=86400",
  }));
  console.log(`Importado: ${filename} → ${key}`);
}
console.log(`Concluída a carga de ${assets.length} fotografias institucionais.`);

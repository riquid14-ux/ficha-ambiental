import crypto from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { ENV } from "./_core/env";

type StorageProvider = "s3" | "manus";
let s3Client: S3Client | null = null;

function normalizeKey(relKey: string): string {
  const key = relKey.replace(/^\/+/, "");
  if (!key || key.length > 500 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key) || key.split("/").some(segment => segment === "." || segment === "..")) {
    throw new Error("Chave de armazenamento inválida.");
  }
  return key;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function provider(): StorageProvider {
  const configured = ENV.storageProvider.toLowerCase();
  if (configured === "s3") return "s3";
  if (configured === "manus") return "manus";
  return ENV.s3Bucket && ENV.s3AccessKeyId && ENV.s3SecretAccessKey ? "s3" : "manus";
}

function getS3Client(): S3Client {
  if (s3Client) return s3Client;
  if (!ENV.s3Bucket || !ENV.s3Region || !ENV.s3AccessKeyId || !ENV.s3SecretAccessKey) {
    throw new Error("S3 corporativo incompleto: defina S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY.");
  }
  s3Client = new S3Client({
    region: ENV.s3Region,
    endpoint: ENV.s3Endpoint || undefined,
    forcePathStyle: ENV.s3ForcePathStyle,
    credentials: {
      accessKeyId: ENV.s3AccessKeyId,
      secretAccessKey: ENV.s3SecretAccessKey,
    },
  });
  return s3Client;
}

function getForgeConfig() {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    throw new Error("Armazenamento de desenvolvimento indisponível. Configure S3 corporativo.");
  }
  return { forgeUrl: ENV.forgeApiUrl.replace(/\/+$/, ""), forgeKey: ENV.forgeApiKey };
}

async function manusPut(key: string, data: Buffer | Uint8Array | string, contentType: string) {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const presignUrl = new URL("v1/storage/presign/put", `${forgeUrl}/`);
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!presignResp.ok) throw new Error(`Presign de armazenamento falhou (${presignResp.status}).`);
  const { url } = await presignResp.json() as { url?: string };
  if (!url) throw new Error("Presign de armazenamento sem URL.");
  const uploadResp = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType }),
  });
  if (!uploadResp.ok) throw new Error(`Upload de armazenamento falhou (${uploadResp.status}).`);
}

async function manusSignedGet(key: string): Promise<string> {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const getUrl = new URL("v1/storage/presign/get", `${forgeUrl}/`);
  getUrl.searchParams.set("path", key);
  const response = await fetch(getUrl, { headers: { Authorization: `Bearer ${forgeKey}` } });
  if (!response.ok) throw new Error(`Leitura de armazenamento falhou (${response.status}).`);
  const { url } = await response.json() as { url?: string };
  if (!url) throw new Error("Leitura de armazenamento sem URL.");
  return url;
}

/**
 * Armazena no S3 compatível do ambiente corporativo (Synology Object Storage
 * ou S3). O adaptador Manus só é permitido como compatibilidade de
 * desenvolvimento e nunca é requisito de produção.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
  options: { unique?: boolean } = {},
): Promise<{ key: string; url: string }> {
  const normalizedKey = normalizeKey(relKey);
  const key = options.unique === false ? normalizedKey : appendHashSuffix(normalizedKey);
  if (provider() === "s3") {
    const body = typeof data === "string" ? Buffer.from(data) : data;
    await getS3Client().send(new PutObjectCommand({ Bucket: ENV.s3Bucket, Key: key, Body: body, ContentType: contentType }));
  } else {
    await manusPut(key, data, contentType);
  }
  return { key, url: `/api/storage/object/${key}` };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/api/storage/object/${key}` };
}

/** URL presigned usado apenas pelo servidor para fazer streaming same-origin. */
export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  if (provider() === "s3") {
    return getSignedUrl(getS3Client(), new GetObjectCommand({ Bucket: ENV.s3Bucket, Key: key }), { expiresIn: 60 });
  }
  return manusSignedGet(key);
}

export function storageProviderName(): StorageProvider {
  return provider();
}

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  sessionIssuer: process.env.SESSION_ISSUER ?? "stand-environmental",
  databaseUrl: process.env.DATABASE_URL ?? "",
  publicBaseUrl: process.env.APP_BASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // O modo corporativo é ativado explicitamente nas VMs Start Campus. O modo
  // gerido mantém os controlos da aplicação mas não exige serviços internos
  // que esse ambiente não disponibiliza.
  runtimeMode: process.env.STAND_RUNTIME_MODE ?? "managed",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  storageProvider: process.env.STORAGE_PROVIDER ?? "auto",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3Region: process.env.S3_REGION ?? "",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  valkeyUrl: process.env.VALKEY_URL ?? "",
  schedulerToken: process.env.SCHEDULER_TOKEN ?? "",
  adsClientId: process.env.ADS_CLIENT_ID ?? "",
  adsClientSecret: process.env.ADS_CLIENT_SECRET ?? "",
  adsRedirectUri: process.env.ADS_REDIRECT_URI ?? "",
  // Apenas para o gateway BMS corporativo. Nunca expor no browser, no Git ou em logs.
  bmsIngestHmacSecret: process.env.BMS_INGEST_HMAC_SECRET ?? "",
  bmsServiceUserId:
    Number.parseInt(process.env.BMS_SERVICE_USER_ID ?? "", 10) || 0,
};

import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL é obrigatória para aplicar a baseline fresh start.");
}

export default defineConfig({
  schema: resolve(currentDirectory, "../../drizzle/schema.ts"),
  out: resolve(currentDirectory, "drizzle"),
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});

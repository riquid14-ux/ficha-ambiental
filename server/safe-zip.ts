import yauzl from "yauzl";

export type SafeZipEntry = {
  fileName: string;
  isDirectory: boolean;
  data: Buffer;
};

const MAX_ENTRIES = 1_000;
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 50 * 1024 * 1024;

function isSafeEntryName(fileName: string) {
  const normalized = fileName.replace(/\\/g, "/");
  return !normalized.startsWith("/") && !normalized.split("/").some(segment => segment === ".." || segment === ".");
}

/**
 * Lê um ZIP apenas em memória, com limites contra zip bombs e recusa caminhos
 * absolutos/ascendentes. É usado exclusivamente para documentos DOCX recebidos.
 */
export function readSafeZipEntries(buffer: Buffer): Promise<SafeZipEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: SafeZipEntry[] = [];
    let entryCount = 0;
    let totalBytes = 0;
    let complete = false;
    let zipFile: yauzl.ZipFile | undefined;

    const fail = (error: Error) => {
      if (complete) return;
      complete = true;
      try { zipFile?.close(); } catch { /* o erro original mantém-se */ }
      reject(error);
    };

    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) return fail(new Error("Não foi possível validar o ficheiro Word."));
      zipFile = zip;

      zip.on("error", error => fail(error instanceof Error ? error : new Error("Arquivo Word inválido.")));
      zip.on("end", () => {
        if (!complete) {
          complete = true;
          resolve(entries);
        }
      });
      zip.on("entry", entry => {
        entryCount += 1;
        if (entryCount > MAX_ENTRIES) return fail(new Error("O documento contém demasiados ficheiros internos."));
        if (!isSafeEntryName(entry.fileName)) return fail(new Error("O documento contém um caminho interno inválido."));
        if (entry.uncompressedSize > MAX_ENTRY_BYTES || totalBytes + entry.uncompressedSize > MAX_TOTAL_BYTES) {
          return fail(new Error("O documento excede o limite de descompressão seguro."));
        }

        const isDirectory = /\/$/.test(entry.fileName);
        if (isDirectory) {
          entries.push({ fileName: entry.fileName, isDirectory: true, data: Buffer.alloc(0) });
          zip.readEntry();
          return;
        }

        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return fail(new Error("Não foi possível ler o conteúdo do documento Word."));
          const chunks: Buffer[] = [];
          let entryBytes = 0;
          stream.on("data", (chunk: Buffer) => {
            entryBytes += chunk.length;
            if (entryBytes > MAX_ENTRY_BYTES || totalBytes + entryBytes > MAX_TOTAL_BYTES) {
              stream.destroy(new Error("O documento excede o limite de descompressão seguro."));
              return;
            }
            chunks.push(chunk);
          });
          stream.on("error", error => fail(error instanceof Error ? error : new Error("Erro a ler o documento Word.")));
          stream.on("end", () => {
            if (complete) return;
            totalBytes += entryBytes;
            entries.push({ fileName: entry.fileName, isDirectory: false, data: Buffer.concat(chunks) });
            zip.readEntry();
          });
        });
      });

      zip.readEntry();
    });
  });
}

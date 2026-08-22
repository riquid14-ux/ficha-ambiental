import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";

interface ExtractedImage {
  page: number;
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

/**
 * Extract readable text from a PDF or DOCX before sending it to the LLM.
 * The model receives text only and never needs to fetch the uploaded file.
 */
export async function extractDocumentText(documentBuffer: Buffer, filename: string): Promise<string> {
  const lowerName = filename.toLowerCase();

  if (lowerName.endsWith(".docx")) {
    const AdmZip = (await import("adm-zip")).default;
    const zip = new AdmZip(documentBuffer);
    const entry = zip.getEntry("word/document.xml");
    if (!entry) throw new Error("Documento Word sem conteúdo legível.");

    return entry
      .getData()
      .toString("utf8")
      .replace(/<w:tab\s*\/?>/g, "\t")
      .replace(/<w:br\s*\/?>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .trim();
  }

  if (!lowerName.endsWith(".pdf")) {
    throw new Error("Apenas ficheiros PDF ou DOCX são suportados.");
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "document-text-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const textPath = path.join(tmpDir, "output.txt");

  try {
    fs.writeFileSync(pdfPath, documentBuffer);
    execFileSync("pdftotext", ["-layout", pdfPath, textPath], {
      timeout: 60000,
      stdio: "ignore",
    });
    return fs.existsSync(textPath) ? fs.readFileSync(textPath, "utf8").trim() : "";
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Extract evidence photos from a PDF file.
 * Uses pdfimages CLI (poppler-utils) to extract JPEG images.
 * Filters out logos/headers (small images like 256x77 TSL logo).
 */
export async function extractImagesFromPdf(pdfBuffer: Buffer): Promise<ExtractedImage[]> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-extract-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const imgPrefix = path.join(tmpDir, "img");

  try {
    // Write PDF to temp file
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Extract images using pdfimages with -j (JPEG output) and -p (page numbers in filenames)
    try {
      execSync(`pdfimages -j -p "${pdfPath}" "${imgPrefix}"`, { timeout: 60000 });
    } catch (e) {
      // pdfimages may not be available in production - return empty
      console.warn("pdfimages not available or failed:", e);
      return [];
    }

    // Read extracted images - only JPEG files (real photos, not PPM logos)
    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith(".jpg") || f.endsWith(".jpeg"));
    const images: ExtractedImage[] = [];

    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      const stat = fs.statSync(filePath);

      // Skip very small images (< 5KB) - likely icons/logos
      if (stat.size < 5000) continue;

      const buffer = fs.readFileSync(filePath);

      // Parse page number from filename: img-010-020.jpg -> page 10
      const pageMatch = file.match(/img-(\d+)-/);
      const page = pageMatch ? parseInt(pageMatch[1], 10) : 0;

      images.push({
        page,
        buffer,
        mimeType: "image/jpeg",
        filename: file,
      });
    }

    return images;
  } finally {
    // Cleanup temp directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // ignore cleanup errors
    }
  }
}

/**
 * Extract images from a Word (.docx) file.
 * DOCX files are ZIP archives with images in word/media/ folder.
 */
export async function extractImagesFromDocx(docxBuffer: Buffer): Promise<ExtractedImage[]> {
  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip(docxBuffer);
  const images: ExtractedImage[] = [];

  const entries = zip.getEntries();
  let imgIndex = 0;

  for (const entry of entries) {
    // Word stores images in word/media/ folder
    if (entry.entryName.startsWith("word/media/") && !entry.isDirectory) {
      const ext = path.extname(entry.entryName).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".bmp": "image/bmp",
        ".tiff": "image/tiff",
        ".emf": "image/emf",
        ".wmf": "image/wmf",
      };

      const mimeType = mimeMap[ext];
      if (!mimeType) continue; // Skip unsupported formats

      // Skip EMF/WMF (vector graphics, usually logos)
      if (ext === ".emf" || ext === ".wmf") continue;

      const buffer = entry.getData();

      // Skip very small images (< 5KB) - likely icons
      if (buffer.length < 5000) continue;

      images.push({
        page: imgIndex,
        buffer,
        mimeType,
        filename: path.basename(entry.entryName),
      });
      imgIndex++;
    }
  }

  return images;
}

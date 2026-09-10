// ═══════════════════════════════════════════════════════════════════════════════
// File Sanitizer — Protects against malicious PDFs and Word documents
// Checks for: JavaScript in PDFs, macros in Word, external links, embedded objects
// ═══════════════════════════════════════════════════════════════════════════════
import { readSafeZipEntries } from "./safe-zip";

export interface SanitizeResult {
  safe: boolean;
  threats: string[];
  fileType: string;
}

// ─── PDF Sanitization ────────────────────────────────────────────────────────
// Checks PDF binary content for dangerous patterns without parsing the full structure
export function sanitizePdf(buffer: Buffer): SanitizeResult {
  const threats: string[] = [];
  const content = buffer.toString("latin1"); // Read as binary string

  // 1. Check for JavaScript actions (most common PDF attack vector)
  if (/\/JavaScript\s/i.test(content) || /\/JS\s/i.test(content)) {
    threats.push("PDF contém JavaScript embebido");
  }

  // 2. Check for auto-open actions that execute on open
  if (/\/OpenAction\s/i.test(content) && /\/JavaScript/i.test(content)) {
    threats.push("PDF contém acção automática com JavaScript ao abrir");
  }

  // 3. Check for Launch actions (can execute system commands)
  if (/\/Launch\s/i.test(content) && /\/Action/i.test(content)) {
    threats.push("PDF contém acção de execução de programa (Launch)");
  }

  // 4. Check for embedded files that could be executables
  if (/\/EmbeddedFile\s/i.test(content)) {
    const hasExe = /\.exe|\.bat|\.cmd|\.ps1|\.vbs|\.scr|\.com|\.msi/i.test(content);
    if (hasExe) {
      threats.push("PDF contém ficheiro executável embebido");
    }
  }

  // 5. Check for URI actions pointing to suspicious protocols
  if (/\/URI\s/i.test(content)) {
    const hasDataUri = /data:text\/html|javascript:/i.test(content);
    if (hasDataUri) {
      threats.push("PDF contém URI com protocolo perigoso (data: ou javascript:)");
    }
  }

  // 6. Check for AcroForm with submit actions (data exfiltration)
  if (/\/SubmitForm\s/i.test(content)) {
    threats.push("PDF contém formulário com submissão automática de dados");
  }

  return {
    safe: threats.length === 0,
    threats,
    fileType: "PDF",
  };
}

// ─── Word Document Sanitization ──────────────────────────────────────────────
// .docx files are ZIP archives — check internal structure for threats
export async function sanitizeDocx(buffer: Buffer): Promise<SanitizeResult> {
  const threats: string[] = [];

  try {
    const entries = await readSafeZipEntries(buffer);

    for (const entry of entries) {
      const name = entry.fileName.toLowerCase();

      // 1. Check for VBA macros (most dangerous — .docm disguised as .docx)
      if (name.includes("vbaproject") || name.includes("vbadata")) {
        threats.push("Documento Word contém macros VBA (possível malware)");
      }

      // 2. Check for ActiveX controls
      if (name.includes("activex")) {
        threats.push("Documento Word contém controlos ActiveX");
      }

      // 3. Check for embedded OLE objects (can contain executables)
      if (name.includes("oleobject") || name.includes("embeddings/")) {
        const data = entry.data.toString("latin1");
        if (/\.exe|\.bat|\.cmd|\.ps1|\.vbs|\.scr|\.dll/i.test(data)) {
          threats.push("Documento Word contém objecto OLE com executável embebido");
        }
      }

      // 4. Check for external relationships (data exfiltration via template injection)
      if (name.endsWith(".rels")) {
        const data = entry.data.toString("utf-8");
        // External targets that aren't standard Microsoft schemas
        const externalMatches = data.match(/Target="https?:\/\/[^"]*"/g) || [];
        for (const match of externalMatches) {
          if (!match.includes("schemas.openxmlformats.org") &&
              !match.includes("schemas.microsoft.com") &&
              !match.includes("purl.org")) {
            threats.push(`Documento Word contém ligação externa suspeita: ${match.slice(8, 60)}...`);
            break; // Report only first suspicious external link
          }
        }
      }
    }
  } catch (err) {
    // If we can't parse as ZIP, it might be an old .doc format
    const content = buffer.toString("latin1");
    if (/\x00VBA/i.test(content) || /ThisDocument/i.test(content)) {
      threats.push("Documento Word (.doc) pode conter macros VBA");
    }
  }

  return {
    safe: threats.length === 0,
    threats,
    fileType: "Word",
  };
}

// ─── SVG Sanitization ────────────────────────────────────────────────────────
export function sanitizeSvg(buffer: Buffer): SanitizeResult {
  const threats: string[] = [];
  const content = buffer.toString("utf-8");

  // 1. Check for script tags
  if (/<script[\s>]/i.test(content)) {
    threats.push("SVG contém tag <script> (XSS)");
  }

  // 2. Check for event handlers (onclick, onload, onerror, etc.)
  if (/\bon\w+\s*=/i.test(content)) {
    threats.push("SVG contém event handlers (possível XSS)");
  }

  // 3. Check for external references that could exfiltrate data
  if (/xlink:href\s*=\s*["'](?:https?:|data:text\/html)/i.test(content)) {
    threats.push("SVG contém referência externa suspeita");
  }

  // 4. Check for foreignObject (can embed HTML)
  if (/<foreignObject/i.test(content)) {
    threats.push("SVG contém foreignObject (pode embeber HTML malicioso)");
  }

  return {
    safe: threats.length === 0,
    threats,
    fileType: "SVG",
  };
}

// ─── Main Sanitizer ─────────────────────────────────────────────────────────
export async function sanitizeFile(buffer: Buffer, mimeType: string, filename: string): Promise<SanitizeResult> {
  switch (mimeType) {
    case "application/pdf":
      return sanitizePdf(buffer);

    case "application/msword":
      return { safe: false, threats: ["Documentos Word legados (.doc) não são aceites por segurança; use .docx ou PDF."], fileType: "Word" };
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return sanitizeDocx(buffer);

    case "image/svg+xml":
      return sanitizeSvg(buffer);

    default:
      // Images (jpeg, png, gif, webp) and spreadsheets are safe by default
      return { safe: true, threats: [], fileType: mimeType };
  }
}

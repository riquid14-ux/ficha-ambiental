import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SOURCE_ROOTS = ["client/src/pages", "client/src/components"];
const PORTUGUESE_MARKERS = /[ãõáéíóúâêôç]|\b(não|está|são|também|através|ficha|medida|projeto|resíduos|ficheiro|carregar)\b/i;
const IGNORE_PATHS = ["/components/ui/"];

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(absolute);
    return /\.tsx?$/.test(entry.name) ? [absolute] : [];
  });
}

function isInsideTranslationCall(node) {
  let current = node.parent;
  while (current) {
    if (ts.isCallExpression(current) && ts.isIdentifier(current.expression) && current.expression.text === "t") return true;
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current)) break;
    current = current.parent;
  }
  return false;
}

const findings = [];
for (const root of SOURCE_ROOTS) {
  const absoluteRoot = path.join(ROOT, root);
  for (const file of listFiles(absoluteRoot)) {
    const normalized = file.replaceAll("\\", "/");
    if (IGNORE_PATHS.some((fragment) => normalized.includes(fragment))) continue;
    const source = fs.readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (ts.isJsxText(node)) {
        const text = node.text.replace(/\s+/g, " ").trim();
        if (text.length > 2 && PORTUGUESE_MARKERS.test(text) && !isInsideTranslationCall(node)) {
          const position = ast.getLineAndCharacterOfPosition(node.getStart(ast));
          findings.push({ file: path.relative(ROOT, file), line: position.line + 1, text });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
}

console.log(`Auditoria i18n: ${findings.length} literal(is) potencialmente PT fora de t().`);
for (const finding of findings) console.log(`${finding.file}:${finding.line} — ${finding.text}`);

if (process.argv.includes("--strict") && findings.length > 0) process.exitCode = 1;

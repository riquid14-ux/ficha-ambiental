import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourceRoots = ["client/src/pages", "client/src/components"];
const ignoredFragments = ["/components/ui/"];
const portugueseMarkers = /[ãõáéíóúâêôç]|\b(não|está|são|também|através|ficha|medida|projeto|resíduos|ficheiro|carregar|consultar|gestão|dados|relatório|submeter|definir|prazos|medição)\b/i;
const attributeNames = new Set(["placeholder", "title", "aria-label", "alt"]);

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : /\.tsx?$/.test(entry.name) ? [absolute] : [];
  });
}

function compact(value) { return value.replace(/\s+/g, " ").trim(); }
function sourceLocation(source, node) {
  const position = source.getLineAndCharacterOfPosition(node.getStart(source));
  return { line: position.line + 1, column: position.character + 1 };
}
function isInTranslationCall(node) {
  let current = node.parent;
  while (current) {
    if (ts.isCallExpression(current) && ts.isIdentifier(current.expression) && current.expression.text === "t") return true;
    current = current.parent;
  }
  return false;
}
function addCandidate(candidates, source, file, node, raw, kind) {
  const text = compact(raw);
  // Inclui também chaves estáticas passadas a t(...). Durante a migração estas
  // podem não existir ainda no dicionário principal e precisam de cobertura EN.
  if (text.length < 3 || !portugueseMarkers.test(text)) return;
  const key = `${text}\u0000${kind}`;
  const location = sourceLocation(source, node);
  if (!candidates.has(key)) candidates.set(key, { text, kind, occurrences: [] });
  candidates.get(key).occurrences.push({ file: path.relative(root, file), ...location });
}

const candidates = new Map();
for (const sourceRoot of sourceRoots) {
  const absoluteRoot = path.join(root, sourceRoot);
  for (const file of listFiles(absoluteRoot)) {
    const normalized = file.replaceAll("\\", "/");
    if (ignoredFragments.some((fragment) => normalized.includes(fragment))) continue;
    const sourceText = fs.readFileSync(file, "utf8");
    const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "t" && ts.isStringLiteral(node.arguments[0])) {
        addCandidate(candidates, source, file, node.arguments[0], node.arguments[0].text, "translation-key");
      }
      if (ts.isJsxText(node)) addCandidate(candidates, source, file, node, node.text, "text");
      if (ts.isJsxAttribute(node) && node.initializer && ts.isIdentifier(node.name) && attributeNames.has(node.name.text)) {
        const value = node.initializer;
        if (ts.isStringLiteral(value)) addCandidate(candidates, source, file, value, value.text, `attribute:${node.name.text}`);
        if (ts.isJsxExpression(value) && value.expression && ts.isStringLiteral(value.expression)) addCandidate(candidates, source, file, value.expression, value.expression.text, `attribute:${node.name.text}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

const results = Array.from(candidates.values()).sort((a, b) => a.text.localeCompare(b.text, "pt-PT"));
process.stdout.write(JSON.stringify(results, null, 2));

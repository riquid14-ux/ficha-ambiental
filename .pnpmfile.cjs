/**
 * Mitigação transitiva de segurança: ExcelJS 4.4.0 declara uuid ^8.3.2,
 * mas a aplicação não depende dessa versão. Durante a resolução, impõe-se
 * uuid 11.1.1, versão que contém a correcção da CVE-2026-41907.
 */
function readPackage(pkg, context) {
  if (pkg.name === "exceljs" && pkg.version === "4.4.0") {
    pkg.dependencies = { ...pkg.dependencies, uuid: "11.1.1" };
    context.log("ExcelJS 4.4.0: uuid actualizado para 11.1.1 por mitigação de segurança.");
  }
  if ((pkg.name === "express" || pkg.name === "body-parser") && pkg.dependencies?.qs) {
    pkg.dependencies = { ...pkg.dependencies, qs: "^6.16.0" };
    context.log(`${pkg.name} ${pkg.version}: qs actualizado para 6.16.0 por mitigação de segurança.`);
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };

#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import ts from "typescript";

const SNAPSHOT_PATH = resolve("test/golden/api-surface.json");
const DTS_EXTENSION = ".d.ts";

function main() {
  const args = new Set(process.argv.slice(2));
  const actual = collectSurface();

  if (args.has("--write")) {
    writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(actual, null, 2)}\n`);
    console.log(`API snapshot written: ${SNAPSHOT_PATH}`);
    return;
  }

  const expected = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  const expectedText = JSON.stringify(expected, null, 2);
  const actualText = JSON.stringify(actual, null, 2);
  if (expectedText !== actualText) {
    console.error("API snapshot mismatch.");
    console.error(`Update intentionally with: node scripts/api-snapshot.mjs --write`);
    process.exit(1);
  }

  console.log(`API snapshot check passed: ${SNAPSHOT_PATH}`);
}

function collectSurface() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const exports = Object.keys(pkg.exports).sort();
  return {
    name: pkg.name,
    type: pkg.type,
    sideEffects: pkg.sideEffects,
    stableRootExportsExperimentalLayers: false,
    files: [...pkg.files].sort(),
    exports,
    dtsSymbols: collectDtsSymbols(pkg.exports)
  };
}

function collectDtsSymbols(exportsMap) {
  const entries = {};
  const blockedExports = new Set(
    Object.entries(exportsMap)
      .filter(([, target]) => target === null)
      .map(([exportName]) => exportName)
  );

  for (const exportName of Object.keys(exportsMap).sort()) {
    if (exportName === "./package.json") {
      continue;
    }

    const target = exportsMap[exportName];
    if (target === null) {
      continue;
    }
    const typeTarget = typeof target === "string" ? null : target.types;
    if (!typeTarget) {
      continue;
    }

    for (const concrete of expandExportTarget(exportName, typeTarget)) {
      if (blockedExports.has(concrete.exportName)) {
        continue;
      }

      if (!existsSync(concrete.path)) {
        entries[concrete.exportName] = ["missing:dts"];
        continue;
      }

      const symbols = new Map();
      collectSymbolsFromFile(concrete.path, symbols, new Set());
      entries[concrete.exportName] = [...symbols.entries()]
        .map(([name, kinds]) => `${[...kinds].sort().join("|")}:${name}`)
        .sort();
    }
  }

  return entries;
}

function expandExportTarget(exportName, typeTarget) {
  if (!exportName.includes("*")) {
    return [{ exportName, path: resolve(typeTarget) }];
  }

  const starIndex = typeTarget.indexOf("*");
  if (starIndex < 0) {
    return [];
  }

  const prefix = typeTarget.slice(0, starIndex);
  const suffix = typeTarget.slice(starIndex + 1);
  const dir = resolve(prefix.endsWith("/") ? prefix : dirname(prefix));
  const filePrefix = prefix.endsWith("/") ? "" : prefix.slice(prefix.lastIndexOf("/") + 1);
  const files = readdirSync(dir)
    .filter((name) => name.startsWith(filePrefix) && name.endsWith(suffix))
    .sort();

  return files.map((file) => {
    const starValue = file.slice(filePrefix.length, file.length - suffix.length);
    return {
      exportName: exportName.replace("*", starValue),
      path: join(dir, file)
    };
  });
}

function collectSymbolsFromFile(filePath, symbols, visited) {
  const normalized = resolve(filePath);
  if (visited.has(normalized) || !existsSync(normalized) || !statSync(normalized).isFile()) {
    return;
  }
  visited.add(normalized);

  const sourceText = readFileSync(normalized, "utf8");
  const source = ts.createSourceFile(normalized, sourceText, ts.ScriptTarget.Latest, true);

  for (const statement of source.statements) {
    collectStatementSymbol(statement, normalized, symbols, visited);
  }
}

function collectStatementSymbol(statement, filePath, symbols, visited) {
  if (ts.isExportDeclaration(statement)) {
    collectExportDeclaration(statement, filePath, symbols, visited);
    return;
  }

  if (ts.isFunctionDeclaration(statement) && hasExportModifier(statement) && statement.name) {
    addSymbol(symbols, statement.name.text, "function");
    return;
  }

  if (ts.isInterfaceDeclaration(statement) && hasExportModifier(statement)) {
    addSymbol(symbols, statement.name.text, "interface");
    return;
  }

  if (ts.isTypeAliasDeclaration(statement) && hasExportModifier(statement)) {
    addSymbol(symbols, statement.name.text, "type");
    return;
  }

  if (ts.isClassDeclaration(statement) && hasExportModifier(statement) && statement.name) {
    addSymbol(symbols, statement.name.text, "class");
    return;
  }

  if (ts.isEnumDeclaration(statement) && hasExportModifier(statement)) {
    addSymbol(symbols, statement.name.text, "enum");
    return;
  }

  if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        addSymbol(symbols, declaration.name.text, "const");
      }
    }
  }
}

function collectExportDeclaration(statement, filePath, symbols, visited) {
  const modulePath = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
    ? resolveDtsModule(filePath, statement.moduleSpecifier.text)
    : null;

  if (!statement.exportClause) {
    if (modulePath) {
      collectSymbolsFromFile(modulePath, symbols, visited);
    }
    return;
  }

  if (!ts.isNamedExports(statement.exportClause)) {
    return;
  }

  for (const element of statement.exportClause.elements) {
    const name = element.name.text;
    const kind = statement.isTypeOnly || element.isTypeOnly ? "type-reexport" : "reexport";
    addSymbol(symbols, name, kind);
  }
}

function resolveDtsModule(fromFile, specifier) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  const base = resolve(dirname(fromFile), specifier);
  if (base.endsWith(".js")) {
    return `${base.slice(0, -3)}${DTS_EXTENSION}`;
  }
  if (base.endsWith(DTS_EXTENSION)) {
    return base;
  }
  return `${base}${DTS_EXTENSION}`;
}

function hasExportModifier(node) {
  return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;
}

function addSymbol(symbols, name, kind) {
  let kinds = symbols.get(name);
  if (!kinds) {
    kinds = new Set();
    symbols.set(name, kinds);
  }
  kinds.add(kind);
}

main();

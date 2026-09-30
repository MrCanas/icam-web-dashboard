import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import ts from "typescript";

/**
 * referencia/api-componentes.d.ts.txt es lo que se le enseña a Claude como API
 * de componentes. Si un componente TSX cambia de props y el API no, Claude
 * escribiría slides que no pintan: este test lo impide.
 *
 * Comprueba que (1) el API declara exactamente los componentes del registro y
 * (2) cada prop que el API anuncia existe en las props del componente TSX.
 */

const RAIZ = resolve(process.cwd(), "src/modules/pm/informes");
const API = resolve(RAIZ, "referencia/api-componentes.d.ts.txt");
const INDICE = resolve(RAIZ, "slides/components/index.ts");

function programa() {
  const apiTs = resolve(RAIZ, "referencia/__api__.d.ts");
  const texto = readFileSync(API, "utf8");
  const host = ts.createCompilerHost({ strict: true, jsx: ts.JsxEmit.ReactJSX });
  const leer = host.readFile.bind(host);
  host.readFile = (f) => (resolve(f) === apiTs ? texto : leer(f));
  const existe = host.fileExists.bind(host);
  host.fileExists = (f) => resolve(f) === apiTs || existe(f);
  const p = ts.createProgram(
    [apiTs, INDICE],
    {
      strict: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2020,
      skipLibCheck: true,
      noEmit: true,
      baseUrl: process.cwd(),
      paths: { "@/*": ["./src/*"] },
    },
    host,
  );
  return { p, apiTs };
}

function propsDe(checker: ts.TypeChecker, firma: ts.Signature | undefined): string[] {
  const param = firma?.getParameters()[0];
  if (!param) return [];
  const tipo = checker.getTypeOfSymbol(param);
  return checker.getPropertiesOfType(tipo).map((s) => s.getName());
}

test("el API de componentes coincide con los componentes TSX", () => {
  const { p, apiTs } = programa();
  const checker = p.getTypeChecker();

  const api = new Map<string, string[]>();
  const fuenteApi = p.getSourceFile(apiTs)!;
  fuenteApi.forEachChild((n) => {
    if (ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text)) {
      api.set(n.name.text, propsDe(checker, checker.getSignatureFromDeclaration(n)));
    }
  });

  const indice = p.getSourceFile(INDICE)!;
  const simbolo = checker.getSymbolAtLocation(indice)!;
  const registro = checker.getExportsOfModule(simbolo).find((s) => s.getName() === "COMPONENTES")!;
  const tipoRegistro = checker.getTypeOfSymbol(registro);
  const tsx = new Map<string, string[]>();
  for (const prop of checker.getPropertiesOfType(tipoRegistro)) {
    const tipo = checker.getTypeOfSymbol(prop);
    tsx.set(prop.getName(), propsDe(checker, tipo.getCallSignatures()[0]));
  }

  assert.deepEqual([...api.keys()].sort(), [...tsx.keys()].sort(), "El API y el registro nombran componentes distintos");
  for (const [nombre, props] of api) {
    const reales = new Set(tsx.get(nombre));
    const faltan = props.filter((x) => !reales.has(x));
    assert.deepEqual(faltan, [], `${nombre}: el API anuncia props que el componente no tiene`);
  }
});

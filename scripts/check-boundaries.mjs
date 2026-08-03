import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
const root = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const allowed = new Set(["@elqora/dgp-ordering"]);
const peers = new Set(["@timeax/form-palette", "react", "react-dom"]);
const errors = [];
for (const name of Object.keys(pkg.dependencies ?? {})) if (!allowed.has(name)) errors.push(`Forbidden runtime dependency ${name}.`);
for (const required of peers) if (!(required in (pkg.peerDependencies ?? {}))) errors.push(`Missing peer dependency ${required}.`);
for (const file of (await readdir(path.join(root, "src"), { recursive: true })).filter((entry) => /\.tsx?$/.test(entry))) {
  const relative = path.join("src", file);
  const source = ts.createSourceFile(relative, await readFile(path.join(root, relative), "utf8"), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const name = node.moduleSpecifier.getText(source).replaceAll(/["']/g, "");
      if (!name.startsWith(".") && !allowed.has(name) && !peers.has(name)) errors.push(`${relative} imports forbidden package ${name}.`);
    }
    if ((ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && ["OrderingInputState", "OrderSnapshot", "ProductDefinition"].includes(node.name.text)) errors.push(`${relative} reauthors shared type ${node.name.text}.`);
    ts.forEachChild(node, visit);
  }
  visit(source);
}
if (errors.length > 0) throw new Error(`Form Palette adapter boundary violations:\n${errors.join("\n")}`);
console.log("Form Palette adapter boundaries are valid.");

const fs = require("fs");
const path = require("path");

const moduleRoot = path.join(__dirname, "..", "node_modules", "next-auth");

if (!fs.existsSync(moduleRoot)) {
  console.warn("[patch-next-auth] next-auth not found, skipping");
  process.exit(0);
}

const filesToPatch = [
  path.join(moduleRoot, "lib", "actions.js"),
  path.join(moduleRoot, "src", "lib", "actions.ts"),
  path.join(moduleRoot, "lib", "index.js"),
  path.join(moduleRoot, "src", "lib", "index.ts"),
];

function replaceAll(source, regex, replacer) {
  let changed = false;
  const updated = source.replace(regex, (...args) => {
    changed = true;
    return typeof replacer === "function" ? replacer(...args) : replacer;
  });
  return { changed, updated };
}

function patchActions(filePath) {
  let content = fs.readFileSync(filePath, "utf8");
  if (content.includes("await nextHeaders()")) {
    return false;
  }

  const { changed, updated } = replaceAll(
    content,
    /(\s*)const headers = new Headers\(nextHeaders\(\)\)(;?)/g,
    (_, indent, semicolon) => {
      const semi = semicolon ?? "";
      return (
        `${indent}const headersList = await nextHeaders()${semi}\n` +
        `${indent}const headers = new Headers(headersList)${semi}`
      );
    },
  );

  if (!changed) {
    console.warn(`[patch-next-auth] No changes applied to ${filePath}`);
    return false;
  }

  fs.writeFileSync(filePath, updated, "utf8");
  return true;
}

function patchIndex(filePath) {
  let content = fs.readFileSync(filePath, "utf8");

  const hasAsyncHeaders = content.includes("await headers()");

  let patched = false;

  const { changed: changedBasic, updated: updatedBasic } = replaceAll(
    content,
    /(\s*)return \(\.\.\.args\) => {/g,
    (match, indent) => `${indent}return async (...args) => {`,
  );
  content = updatedBasic;
  patched = patched || changedBasic;

  const { changed: changedTyped, updated: updatedTyped } = replaceAll(
    content,
    /(\s*)return \(\.\.\.args: WithAuthArgs\) => {/g,
    (match, indent) => `${indent}return async (...args: WithAuthArgs) => {`,
  );
  content = updatedTyped;
  patched = patched || changedTyped;

  const { changed: changedFirst, updated: updatedFirst } = replaceAll(
    content,
    /(const _headers = )headers\(\)(;?)/,
    (match, prefix, semicolon = "") => `${prefix}await headers()${semicolon}`,
  );
  content = updatedFirst;
  patched = patched || changedFirst;

  const promisePattern =
    /(\s*)return getSession\(headers\(\), config\)\.then\(\(r\) => r\.json\(\)\)(;?)/;
  if (promisePattern.test(content)) {
    const { updated: updatedSecond } = replaceAll(
      content,
      promisePattern,
      (match, indent, semi) =>
        `${indent}const _headers = await headers()${semi}\n${indent}return getSession(_headers, config).then((r) => r.json())${semi}`,
    );
    content = updatedSecond;
    patched = true;
  }

  if (!patched && hasAsyncHeaders) {
    return false;
  }

  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

let totalPatched = 0;

for (const file of filesToPatch) {
  if (!fs.existsSync(file)) {
    console.warn(`[patch-next-auth] File not found: ${file}`);
    continue;
  }
const patched = file.includes("actions") ? patchActions(file) : patchIndex(file);
  if (patched) {
    totalPatched += 1;
    console.log(`[patch-next-auth] Patched ${path.relative(path.join(__dirname, ".."), file)}`);
  }
}

if (totalPatched === 0) {
  console.log("[patch-next-auth] No patches applied (maybe already patched)");
}

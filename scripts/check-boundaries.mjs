// 依赖边界检查：保证各目录只依赖允许依赖的东西（规则见 docs/architecture.md）。
// 用法：node scripts/check-boundaries.mjs（或 npm run check:boundaries）
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");

const NODE_BUILTINS = new Set([
  "fs", "path", "os", "http", "https", "net", "crypto", "stream", "url", "util", "child_process",
  "events", "buffer", "zlib", "worker_threads", "assert", "readline", "timers", "tls", "dns",
]);
const isNodeBuiltin = (spec) =>
  spec.startsWith("node:") || NODE_BUILTINS.has(spec.split("/")[0]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

/** 取出文件里所有 import / export-from / 动态 import / require 的模块名 */
function importsOf(text) {
  const specs = [];
  const re = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)["']([^"']+)["']/g;
  for (const m of text.matchAll(re)) specs.push(m[1]);
  return specs;
}

/** 把导入解析成相对 src 的路径（仅处理别名和相对路径；第三方包返回 null） */
function resolveLocal(fromFile, spec) {
  if (spec.startsWith("@shared/")) return join("shared", spec.slice(8));
  if (spec.startsWith("@main/")) return join("main", spec.slice(6));
  if (spec.startsWith("@renderer/")) return join("renderer", "src", spec.slice(10));
  if (spec.startsWith(".")) return relative(src, resolve(dirname(fromFile), spec));
  return null;
}

const area = (p) => p.split(sep)[0]; // shared | main | preload | renderer
const problems = [];
const bad = (file, spec, why) => problems.push(`${relative(root, file)}：不允许 import "${spec}"（${why}）`);

for (const file of walk(src)) {
  const rel = relative(src, file);
  const where = area(rel);
  const isTest = /\.test\.tsx?$/.test(file);
  const text = readFileSync(file, "utf8");

  for (const spec of importsOf(text)) {
    const local = resolveLocal(file, spec);
    const target = local ? area(local) : null;

    // ---- 目录级规则 ----
    if (where === "shared") {
      if (spec === "electron" || spec === "react" || spec === "zustand" || spec.startsWith("react-")) bad(file, spec, "shared 不能依赖 electron / react");
      if (isNodeBuiltin(spec) && !isTest) bad(file, spec, "shared 不能依赖 node 内置模块");
      if (target && target !== "shared") bad(file, spec, "shared 不能依赖其他目录");
    } else if (where === "preload") {
      if (target && target !== "shared") bad(file, spec, "preload 只能依赖 shared");
    } else if (where === "main") {
      if (spec === "react" || spec === "zustand" || spec.startsWith("react-")) bad(file, spec, "主进程不能依赖 react");
      if (target === "renderer" || target === "preload") bad(file, spec, "主进程不能依赖渲染进程或 preload");
    } else if (where === "renderer") {
      if (spec === "electron" || spec === "better-sqlite3" || spec === "sharp" || spec === "chokidar") bad(file, spec, "渲染进程不能依赖 electron / 原生库");
      if (isNodeBuiltin(spec) && !isTest) bad(file, spec, "渲染进程不能依赖 node 内置模块");
      if (target === "main" || target === "preload") bad(file, spec, "渲染进程不能依赖主进程");
    }
    if (!local) continue;

    // ---- 主进程：模块之间只能通过 index.ts ----
    const m = /^main\/modules\/([^/]+)(?:\/(.*))?$/.exec(local);
    const from = /^main\/modules\/([^/]+)\//.exec(rel);
    if (m && from && m[1] !== from[1] && m[2] && m[2] !== "index" && m[2] !== "index.ts") {
      bad(file, spec, `模块 ${from[1]} 不能直接引用模块 ${m[1]} 的内部文件，请通过 modules/${m[1]}/index.ts`);
    }
    // 下层不能依赖上层：core / db 不能依赖 modules / app；modules 不能依赖 app
    if (where === "main") {
      const layer = rel.split(sep)[1];
      const tlayer = local.split(sep)[1];
      if ((layer === "core" || layer === "db") && (tlayer === "modules" || tlayer === "app")) bad(file, spec, `${layer} 层不能依赖 ${tlayer} 层`);
      if (layer === "modules" && tlayer === "app") bad(file, spec, "modules 不能依赖 app 层");
      if (layer === "core" && tlayer === "db") bad(file, spec, "core 不能依赖 db");
    }

    // ---- 渲染进程：features / shared / store 的层次 ----
    if (where === "renderer") {
      const rParts = rel.split(sep); // renderer/src/<layer>/...
      const layer = rParts[2];
      const tParts = local.split(sep);
      const tlayer = tParts[2];
      if ((layer === "shared" || layer === "store") && tlayer === "features") bad(file, spec, `${layer} 不能依赖 features`);
      if (layer === "shared" && (tlayer === "store" || tlayer === "app" || tlayer === "dev")) bad(file, spec, `shared 不能依赖 ${tlayer}`);
      if (layer === "store" && (tlayer === "app" || tlayer === "dev")) bad(file, spec, `store 不能依赖 ${tlayer}`);
      if (layer === "features" && (tlayer === "app" || tlayer === "dev")) bad(file, spec, `features 不能依赖 ${tlayer}`);
      if (layer === "features" && tlayer === "features" && tParts[3] !== rParts[3]) {
        const inner = tParts.slice(4).join("/");
        if (inner && inner !== "index" && inner !== "index.ts" && inner !== "index.tsx") {
          bad(file, spec, `feature ${rParts[3]} 不能直接引用 feature ${tParts[3]} 的内部文件，请通过它的 index.ts`);
        }
      }
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n共 ${problems.length} 处违反依赖边界，规则见 docs/architecture.md`);
  process.exit(1);
}
console.log("OK：依赖边界检查通过");

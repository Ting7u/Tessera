// 检查 zh.json 和 en.json 是否对得上：node scripts/check-i18n.mjs（或 npm run check:i18n）
// 查的是：一边有、另一边缺的键；{count} 之类占位符两边不一致；复数键缺 _other
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../src/shared/i18n/locales");
const load = (name) => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8"));
const zh = load("zh");
const en = load("en");

const PLURAL = /_(zero|one|two|few|many|other)$/;
const base = (key) => key.replace(PLURAL, "");
const baseKeys = (dict) => new Set(Object.keys(dict).map(base));

function placeholders(dict) {
  const result = new Map();
  for (const [key, value] of Object.entries(dict)) {
    const set = result.get(base(key)) ?? new Set();
    for (const match of String(value).matchAll(/\{(\w+)\}/g)) set.add(match[1]);
    result.set(base(key), set);
  }
  return result;
}

const problems = [];
const zhKeys = baseKeys(zh);
const enKeys = baseKeys(en);
for (const key of zhKeys) if (!enKeys.has(key)) problems.push(`en.json 缺少：${key}`);
for (const key of enKeys) if (!zhKeys.has(key)) problems.push(`zh.json 缺少：${key}`);

const zhHolders = placeholders(zh);
const enHolders = placeholders(en);
for (const key of zhKeys) {
  if (!enKeys.has(key)) continue;
  const a = [...(zhHolders.get(key) ?? [])].sort().join(",");
  const b = [...(enHolders.get(key) ?? [])].sort().join(",");
  if (a !== b) problems.push(`占位符不一致：${key}（zh: {${a}}，en: {${b}}）`);
}

for (const [name, dict] of [["zh", zh], ["en", en]]) {
  for (const key of Object.keys(dict)) {
    if (PLURAL.test(key) && !(`${base(key)}_other` in dict)) {
      problems.push(`${name}.json 的复数键缺少 _other：${base(key)}`);
    }
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`OK：${zhKeys.size} 个键，中英文对得上`);

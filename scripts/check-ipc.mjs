// IPC 完整性检查（不用启动应用）：
//  1. contract.ts 里声明的每个 invoke / send / sync 通道，都必须在 src/main 里有 handle / onSend / onSync 实现
//  2. spec.ts 里绑定的通道都必须在 contract.ts 里声明
//  3. 浏览器扩展里的端口范围必须和 shared/constants.ts 一致
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

const contract = read("src/shared/ipc/contract.ts");
const spec = read("src/shared/ipc/spec.ts");

/** 取出 interface 块里所有 "channel": 形式的键 */
function channelsOf(interfaceName) {
  const m = new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`).exec(contract);
  if (!m) throw new Error(`contract.ts 里找不到 ${interfaceName}`);
  return [...m[1].matchAll(/^\s*"([^"]+)":/gm)].map((x) => x[1]);
}

const invoke = channelsOf("InvokeMap");
const send = channelsOf("SendMap");
const sync = channelsOf("SyncMap");
const events = channelsOf("EventMap");

const mainSource = walk(join(root, "src/main")).map((f) => readFileSync(f, "utf8")).join("\n");
const problems = [];

const impl = (fn, channel) => new RegExp(`\\b${fn}\\(\\s*"${channel.replace(/[:\-]/g, "\\$&")}"`).test(mainSource);
for (const c of invoke) if (!impl("handle", c)) problems.push(`invoke 通道没有 handle 实现：${c}`);
for (const c of send) if (!impl("onSend", c)) problems.push(`send 通道没有 onSend 实现：${c}`);
for (const c of sync) if (!impl("onSync", c)) problems.push(`sync 通道没有 onSync 实现：${c}`);

const all = new Set([...invoke, ...send, ...sync, ...events]);
for (const m of spec.matchAll(/\b(?:invoke|send|on)\("([^"]+)"\)/g)) {
  if (!all.has(m[1])) problems.push(`spec.ts 绑定了未声明的通道：${m[1]}`);
}
const used = new Set([...spec.matchAll(/\b(?:invoke|send|on)\("([^"]+)"\)/g)].map((m) => m[1]));
for (const c of [...invoke, ...send, ...events]) if (!used.has(c)) problems.push(`通道已声明但 spec.ts 没有绑定：${c}`);

// 浏览器扩展端口
const constants = read("src/shared/constants.ts");
const start = Number(/BRIDGE_PORT_START\s*=\s*(\d+)/.exec(constants)?.[1]);
const count = Number(/BRIDGE_PORT_COUNT\s*=\s*(\d+)/.exec(constants)?.[1]);
const ext = /PORTS\s*=\s*Array\.from\(\{\s*length:\s*(\d+)\s*\},\s*\(_, i\)\s*=>\s*(\d+)\s*\+\s*i\)/.exec(read("extensions/browser/background.js"));
if (!ext) problems.push("extensions/browser/background.js 里找不到 PORTS 定义");
else if (Number(ext[1]) !== count || Number(ext[2]) !== start) {
  problems.push(`浏览器扩展端口范围（${ext[2]} +${ext[1]}）与 shared/constants.ts（${start} +${count}）不一致`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`OK：${invoke.length} 个 invoke、${send.length} 个 send、${sync.length} 个 sync、${events.length} 个事件，全部对得上`);

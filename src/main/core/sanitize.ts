// 入参收敛：渲染进程传来的一切参数都不可信，处理函数里先用这些函数校验、限制范围。
const TAG_MAX = 30;

/** 正整数 id；不合法返回 null */
export function toId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** 标签名 / 分类名：折叠空白、去首尾空格、最多 30 个字符 */
export function cleanTag(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAG_MAX);
}

/** id 数组：去重、丢弃非法值、限制数量（防止渲染进程传来过大的数组） */
export function cleanIds(raw: unknown, max: number): number[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw
    .slice(0, max)
    .map(toId)
    .filter((id): id is number => id !== null);
  return [...new Set(ids)];
}

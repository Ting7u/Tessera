// 排序方式的定义。界面（顶部栏菜单、列表标题）和 store 共用这一份
// by 对应主进程 db/queries 里的排序列；dirs 的顺序就是菜单里“顺序”区的显示顺序
// 显示的名字不在这里：排序依据是 sort.by.<key>，顺序是 sort.dir.<key>.<dir>，都在 locales 里
import type { SortBy, SortDir, SortSpec } from "@shared/types";

export interface SortKeyInfo {
  key: SortBy;
  defaultDir: SortDir;
  dirs: SortDir[];
}

export const SORT_KEYS: readonly SortKeyInfo[] = [
  { key: "taken", defaultDir: "desc", dirs: ["desc", "asc"] },
  { key: "added", defaultDir: "desc", dirs: ["desc", "asc"] },
  { key: "name", defaultDir: "asc", dirs: ["asc", "desc"] },
  { key: "size", defaultDir: "desc", dirs: ["desc", "asc"] },
];

export const sortInfo = (by: SortBy): SortKeyInfo =>
  SORT_KEYS.find((k) => k.key === by) ?? SORT_KEYS[0];

/** sort 为 null 表示没有手动选过，用默认：“最近导入”按导入时间，其余按拍摄时间 */
export function resolveSort(active: string, sort: SortSpec | null): SortSpec {
  if (sort) return sort;
  return { by: active === "recent" ? "added" : "taken", dir: "desc" };
}

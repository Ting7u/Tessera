// 排序：白名单列 + 默认值。纯函数。
import type { SortBy, SortDir, SortSpec } from "@shared/types";

/**
 * 允许的排序列（白名单）。expr 是常量，永远不会拼接用户输入；
 * field 是返回给界面的行里对应的字段，用来生成翻页游标
 */
export const SORT_COLUMNS: Record<SortBy, { expr: string; field: string; numeric: boolean }> = {
  taken: { expr: "taken_at", field: "takenAt", numeric: true },
  added: { expr: "added_at", field: "addedAt", numeric: true },
  name: { expr: "name COLLATE NOCASE", field: "name", numeric: false },
  size: { expr: "size", field: "size", numeric: true },
};

export interface ResolvedSort {
  by: SortBy;
  dir: SortDir;
  expr: string;
  field: string;
  numeric: boolean;
  order: "ASC" | "DESC";
  /** keyset 分页的比较符 */
  cmp: ">" | "<";
}

/** 不合法就用默认：“最近导入”按导入时间，其余按拍摄时间，都是从新到旧 */
export function resolveSort(
  filter: unknown,
  sort: Partial<SortSpec> | null | undefined,
): ResolvedSort {
  const by: SortBy =
    sort?.by !== undefined && Object.hasOwn(SORT_COLUMNS, sort.by)
      ? sort.by
      : filter === "recent"
        ? "added"
        : "taken";
  const dir: SortDir = sort?.dir === "asc" ? "asc" : "desc";
  return {
    by,
    dir,
    ...SORT_COLUMNS[by],
    order: dir === "asc" ? "ASC" : "DESC",
    cmp: dir === "asc" ? ">" : "<",
  };
}
